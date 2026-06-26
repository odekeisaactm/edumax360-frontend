'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, payrollAPI, salarySettingsAPI, staffBankDetailsAPI } from '@/lib/salary_management.service';
import { SalaryStructure, SalarySetting } from '@/lib/salary_management.types';
import {
  Layers, Play, Search, X, CheckCircle, AlertCircle, Loader2,
  Plus, Eye, MinusCircle, PlusCircle, DollarSign,
  UserCircle, Building2, RefreshCw, CheckCheck, Loader, Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalculationResult {
  grossIncomeMonthly: number;
  totalAdditionalAllowances: number;
  totalStatutoryDeductions: number;
  monthlyTax: number;
  totalOtherDeductions: number;
  netSalary: number;
}

interface DynamicRow { id: string; name: string; amount: number; }
let _rowId = 0;
const genRowId = () => `row-${++_rowId}`;

interface StaffRowData {
  structure: SalaryStructure;
  bank_name: string;
  deductions: DynamicRow[];
  allowances: DynamicRow[];
  autoAllowances: { name: string; amount: number }[];
  monthlyTax: number;
  amount_paid: number;
  // NEW: true once a real (>0) amount_paid has been saved to the DB for this record.
  // While true, amount_paid is locked and will never be overwritten by recalculation.
  amount_paid_locked: boolean;
  is_paid: boolean;
  record_id: number | null;
  preview: CalculationResult;
  checked: boolean;
}

interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
let _toastId = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Unwrap API response helper ───────────────────────────────────────────────
function unwrapList(res: any): any[] {
  const data = res?.results?.data ?? res?.data?.results ?? res?.data ?? res?.results ?? res;
  return Array.isArray(data) ? data : [];
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear  = now.getFullYear();

// ─── Salary Calculator (fallback for unprocessed staff only) ─────────────────
function calculateSalary(
  monthlySalary: number,
  setting: SalarySetting,
  additionalValues: Record<string, number> = {},
  bonus: number = 0,
  additionalIncome: Record<string, number> = {},
  customDeductions: Record<string, number> = {},
): CalculationResult {
  monthlySalary = Math.round(monthlySalary * 100) / 100;

  const basicComponents: Record<string, { monthly: number }> = {};
  if (setting.basic_components) {
    Object.values(setting.basic_components).forEach((c: any) => {
      basicComponents[c.code] = { monthly: (monthlySalary * (parseFloat(c.percentage) || 0)) / 100 };
    });
  }

  const calcBase = (basedOn: string, type: string): number => {
    if (type === 'additional_field') return additionalValues[basedOn] || 0;
    if (basedOn.toUpperCase() === 'TOTAL') return monthlySalary;
    return basedOn.toUpperCase().split('+').reduce((t, c) => t + (basicComponents[c.trim()]?.monthly ?? 0), 0);
  };

  let totalAutoAllowances = 0;
  (setting.allowances || []).forEach((a: any) => {
    if (a.is_active !== false && !a.annual_only) {
      const base  = calcBase(a.based_on || 'TOTAL', a.based_on_type || 'component');
      const pct   = parseFloat(a.percentage) || 0;
      const fixed = parseFloat(a.fixed_amount) || 0;
      if (a.calculation_type === 'fixed')           totalAutoAllowances += fixed;
      else if (a.calculation_type === 'percentage') totalAutoAllowances += (base * pct) / 100;
      else                                          totalAutoAllowances += (base * pct) / 100 + fixed;
    }
  });

  const totalAdditionalAllowances = Object.values(additionalIncome).reduce((s, v) => s + v, 0);
  const grossIncomeMonthly = monthlySalary + bonus + totalAutoAllowances + totalAdditionalAllowances;

  let totalStatutoryDeductions = 0;
  (setting.statutory_deductions || []).forEach((d: any) => {
    if (d.is_active !== false) {
      const base  = calcBase(d.based_on || 'B', d.based_on_type || 'component');
      const pct   = parseFloat(d.percentage) || 0;
      const fixed = parseFloat(d.fixed_amount) || 0;
      if (d.calculation_type === 'fixed')           totalStatutoryDeductions += fixed;
      else if (d.calculation_type === 'percentage') totalStatutoryDeductions += (base * pct) / 100;
      else                                          totalStatutoryDeductions += (base * pct) / 100 + fixed;
    }
  });

  const annualGross = (monthlySalary + bonus) * 12;
  let totalReliefs  = totalStatutoryDeductions * 12;
  (setting.reliefs_exemptions || []).forEach((r: any) => {
    if (r.is_active !== false) {
      const base  = r.based_on === 'gross_income'
        ? annualGross
        : calcBase(r.based_on || 'B', r.based_on_type || 'component') * 12;
      const pct   = parseFloat(r.percentage) || 0;
      const fixed = parseFloat(r.fixed_amount) || 0;
      if (r.calculation_type === 'fixed')           totalReliefs += fixed;
      else if (r.calculation_type === 'percentage') totalReliefs += (base * pct) / 100;
      else                                          totalReliefs += (base * pct) / 100 + fixed;
    }
  });

  const taxableIncome = Math.max(0, annualGross - totalReliefs);
  let annualTax = 0, remaining = taxableIncome;
  (setting.tax_brackets || []).forEach((b: any) => {
    if (remaining > 0) {
      const limit   = b.limit != null ? parseFloat(b.limit) : remaining;
      const taxable = Math.min(remaining, limit);
      annualTax  += (taxable * (parseFloat(b.rate) || 0)) / 100;
      remaining  -= taxable;
    }
  });

  const monthlyTax           = annualTax / 12;
  const totalOtherDeductions = Object.values(customDeductions).reduce((s, v) => s + v, 0);
  const netSalary            = grossIncomeMonthly - totalStatutoryDeductions - monthlyTax - totalOtherDeductions;

  return { grossIncomeMonthly, totalAdditionalAllowances, totalStatutoryDeductions, monthlyTax, totalOtherDeductions, netSalary };
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

// ─── Add Row Modal ─────────────────────────────────────────────────────────────
function AddRowModal({
  open, onClose, onSubmit, title, color, typeOptions,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (name: string, amount: number) => void;
  title: string; color: 'red' | 'green'; typeOptions: { name: string }[];
}) {
  const [selectedName, setSelectedName] = useState('');
  const [amt, setAmt]                   = useState('');

  useEffect(() => { if (open) { setSelectedName(''); setAmt(''); } }, [open]);
  if (!open) return null;

  const canSubmit = selectedName.trim() !== '' && parseFloat(amt) > 0;
  const isGreen   = color === 'green';
  const btnCls    = isGreen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';
  const ringCls   = isGreen ? 'focus:ring-green-500' : 'focus:ring-red-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Type</label>
            {typeOptions.length > 0 ? (
              <select className={`${inputCls} ${ringCls}`} value={selectedName} onChange={e => setSelectedName(e.target.value)}>
                <option value="">Select type…</option>
                {typeOptions.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            ) : (
              <input type="text" className={`${inputCls} ${ringCls}`}
                value={selectedName} onChange={e => setSelectedName(e.target.value)}
                placeholder="Enter label…" />
            )}
          </div>
          <div>
            <label className={labelCls}>Amount (₦)</label>
            <input type="number" className={`${inputCls} ${ringCls}`}
              value={amt} onChange={e => setAmt(e.target.value)}
              placeholder="0.00" step="0.01" min="0" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => { if (canSubmit) onSubmit(selectedName.trim(), parseFloat(amt)); }}
            disabled={!canSubmit}
            className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white ${btnCls} rounded-xl disabled:opacity-50`}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Row ────────────────────────────────────────────────────────────────
function StaffRow({
  data, onCheckChange, onOpenDeductionModal, onOpenAllowanceModal,
  onRemoveDeduction, onRemoveAllowance, onViewPayslip, onAmountPaidChange,
}: {
  data: StaffRowData;
  onCheckChange: (id: number) => void;
  onOpenDeductionModal: (id: number) => void;
  onOpenAllowanceModal: (id: number) => void;
  onRemoveDeduction: (structureId: number, rowId: string) => void;
  onRemoveAllowance: (structureId: number, rowId: string) => void;
  onViewPayslip: (recordId: number) => void;
  onAmountPaidChange: (structureId: number, value: number) => void;
}) {
  const staff    = (data.structure.staff_detail as any) || (data.structure.staff as any) || {};
  const fullName = staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unknown';
  const deptName = staff.department_name || '';
  const staffId  = staff.staff_id || '';
  const image    = staff.image || null;

  const totalAllowances = data.allowances.reduce((s, a) => s + a.amount, 0);
  const totalDeductions = data.deductions.reduce((s, d) => s + d.amount, 0);
  const isPaid = data.is_paid;

  return (
    <div className={`border rounded-xl bg-white transition-all overflow-hidden ${isPaid ? 'border-emerald-100 opacity-80' : 'border-slate-100 hover:shadow-md'}`}>
      {/* Top */}
      <div className="p-3 flex items-center gap-3 border-b border-slate-50 bg-slate-50/30">
        {image
          ? <img src={image} alt={fullName} className="w-9 h-9 rounded-xl object-cover border-2 border-slate-200 flex-shrink-0" />
          : <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
              <UserCircle className="h-4 w-4 text-indigo-400" />
            </div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{fullName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-slate-400">
            {staffId && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold">{staffId}</span>}
            {deptName && <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{deptName}</span>}
            {data.bank_name && data.bank_name !== 'N/A' && <><span className="text-slate-300">·</span><span>{data.bank_name}</span></>}
          </div>
        </div>
        {isPaid ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid
            </span>
            <Lock className="h-4 w-4 text-slate-300" />
          </div>
        ) : (
          <input type="checkbox" checked={data.checked} onChange={() => onCheckChange(data.structure.id)}
            className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer" />
        )}
      </div>

      {/* Financials */}
      <div className="px-3 py-2.5 flex items-center gap-4 border-b border-slate-50 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Salary</span>
          <span className="font-semibold text-slate-800">{fmtMoney(data.structure.monthly_salary)}</span>
        </div>
        {totalAllowances > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">+Allow</span>
            <span className="font-semibold text-green-700">{fmtMoney(totalAllowances)}</span>
          </div>
        )}
        {totalDeductions > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">-Deduct</span>
            <span className="font-semibold text-red-600">{fmtMoney(totalDeductions)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Take Home</span>
          <span className="font-bold text-indigo-700">{fmtMoney(data.preview.netSalary)}</span>
        </div>
      </div>

      {/* Tags */}
      {(data.allowances.length > 0 || data.deductions.length > 0 || data.autoAllowances.length > 0 || data.monthlyTax > 0) && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-slate-50">
          {data.autoAllowances.map(a => (
            <span key={a.name} className="inline-flex items-center gap-1 pl-1.5 pr-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-[11px] font-semibold">
              <PlusCircle className="h-3 w-3 flex-shrink-0" />
              {a.name}: {fmtMoney(a.amount)}
            </span>
          ))}
          {data.allowances.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-full text-[11px] font-semibold">
              <PlusCircle className="h-3 w-3 flex-shrink-0" />
              {a.name}: {fmtMoney(a.amount)}
              {!isPaid && (
                <button onClick={() => onRemoveAllowance(data.structure.id, a.id)} className="ml-0.5 text-green-400 hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {data.deductions.map(d => (
            <span key={d.id} className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-full text-[11px] font-semibold">
              <MinusCircle className="h-3 w-3 flex-shrink-0" />
              {d.name}: {fmtMoney(d.amount)}
              {!isPaid && (
                <button onClick={() => onRemoveDeduction(data.structure.id, d.id)} className="ml-0.5 text-red-400 hover:text-red-700 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {data.monthlyTax > 0 && (
            <span className="inline-flex items-center gap-1 pl-1.5 pr-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-full text-[11px] font-semibold">
              <MinusCircle className="h-3 w-3 flex-shrink-0" />
              PAYE: {fmtMoney(data.monthlyTax)}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {!isPaid && (
        <div className="px-3 py-2 flex items-center justify-end gap-1.5">
          <button onClick={() => onOpenAllowanceModal(data.structure.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
            <PlusCircle className="h-3.5 w-3.5" /> Allowance
          </button>
          <button onClick={() => onOpenDeductionModal(data.structure.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
            <MinusCircle className="h-3.5 w-3.5" /> Deduction
          </button>

          {/* NEW: Amount Paid input — auto-syncs to take-home until a real payment is saved */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase whitespace-nowrap">Pay</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">₦</span>
              <input
                type="number"
                value={data.amount_paid || ''}
                disabled={data.amount_paid_locked}
                onChange={e => onAmountPaidChange(data.structure.id, parseFloat(e.target.value) || 0)}
                step="0.01" min="0"
                title={data.amount_paid_locked ? 'Amount already saved and locked' : 'Auto-filled from take-home pay; edit if needed'}
                className={`w-28 pl-4 pr-2 py-1 text-xs font-semibold border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                  ${data.amount_paid_locked ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
          </div>

          {data.record_id && (
            <button onClick={() => onViewPayslip(data.record_id!)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
              <Eye className="h-3.5 w-3.5" /> View
            </button>
          )}
        </div>
      )}

      {isPaid && data.record_id && (
        <div className="px-3 py-2 flex items-center justify-end">
          <button onClick={() => onViewPayslip(data.record_id!)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
            <Eye className="h-3.5 w-3.5" /> View Payslip
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkPayslipsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const month = Number(searchParams.get('month')) || currentMonth;
  const year  = Number(searchParams.get('year'))  || currentYear;

  const [settings, setSettings]     = useState<SalarySetting | null>(null);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [staffData, setStaffData]   = useState<StaffRowData[]>([]);
  const [bankMap, setBankMap]       = useState<Record<number, string>>({});
  const [payrollMap, setPayrollMap] = useState<Record<number, any>>({});

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts]       = useState<ToastItem[]>([]);

  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [sortBy, setSortBy]         = useState('name_asc');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dedModal, setDedModal]   = useState<{ open: boolean; structureId: number }>({ open: false, structureId: 0 });
  const [allwModal, setAllwModal] = useState<{ open: boolean; structureId: number }>({ open: false, structureId: 0 });

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Departments derived from structure staff_detail.department_name ──────────
  const departments = useMemo(() => {
    const names = new Set<string>();
    structures.forEach(s => {
      const st = (s.staff_detail as any) || (s.staff as any) || {};
      if (st.department_name) names.add(st.department_name);
    });
    return Array.from(names).sort().map(name => ({ id: name, name }));
  }, [structures]);

  const uniqueBanks = useMemo(() =>
    Array.from(new Set(Object.values(bankMap).filter(Boolean))).sort(),
  [bankMap]);

  const allowanceOptions = useMemo(() =>
    (settings?.income_items || settings?.allowances || []).filter((a: any) => a.is_active !== false),
  [settings]);

  const deductionOptions = useMemo(() =>
    (settings?.other_deductions_config || []).filter((d: any) => !d.linked_to),
  [settings]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [structsRes, setRes] = await Promise.all([
        salaryStructuresAPI.list({ is_active: true, page_size: 1000 }),
        salarySettingsAPI.list(),
      ]) as any[];

      // FIX: unwrap nested results.data wrapper
      const structList: SalaryStructure[] = unwrapList(structsRes);

      // FIX: unwrap setting — handle array or single object
      let setting: SalarySetting | null = null;
      const settingData = setRes?.results?.data ?? setRes?.data ?? setRes?.results ?? setRes;
      if (Array.isArray(settingData)) {
        setting = settingData[0] ?? null;
      } else {
        setting = settingData ?? null;
      }

      setStructures(structList);
      setSettings(setting);

      // Fetch existing payroll records
      try {
        const recordsRes = await payrollAPI.listRecords({ month, year, page_size: 1000 }) as any;
        const records: any[] = unwrapList(recordsRes);
        const rMap: Record<number, any> = {};
        records.forEach(r => {
          const sid = typeof r.staff === 'object' ? r.staff?.id : r.staff;
          if (sid) rMap[sid] = r;
        });
        setPayrollMap(rMap);
      } catch (e) { console.error('Could not fetch payroll records:', e); }

      // Fetch bank details
      try {
        const bankRes = await staffBankDetailsAPI.list({ page_size: 1000 }) as any;
        const bankList: any[] = unwrapList(bankRes);
        const map: Record<number, string> = {};
        bankList.forEach((b: any) => { if (b.staff && b.bank_name) map[b.staff] = b.bank_name; });
        setBankMap(map);
      } catch (e) { console.error('Could not fetch bank details:', e); }

    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Process structures into StaffRowData ──────────────────────────────────
  const processStructures = useCallback(() => {
    if (!settings || structures.length === 0) return;

    let filtered = [...structures];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s => {
        const st   = (s.staff_detail as any) || (s.staff as any);
        const name = (st?.full_name || `${st?.first_name || ''} ${st?.last_name || ''}`).toLowerCase().trim();
        const sid  = (st?.staff_id || '').toLowerCase();
        return name.includes(q) || sid.includes(q);
      });
    }

    if (deptFilter) {
      // FIX: filter by department_name string directly (no ID available)
      filtered = filtered.filter(s => {
        const st = (s.staff_detail as any) || (s.staff as any);
        return st?.department_name === deptFilter;
      });
    }

    if (bankFilter) {
      filtered = filtered.filter(s => {
        const sid = typeof s.staff === 'number' ? s.staff : (s.staff as any).id;
        return bankMap[sid] === bankFilter;
      });
    }

    const [field, dir] = sortBy.split('_');
    filtered.sort((a, b) => {
      const aS = (a.staff_detail as any) || (a.staff as any);
      const bS = (b.staff_detail as any) || (b.staff as any);
      const aV = field === 'name' ? (aS?.full_name || '').toLowerCase() : (aS?.department_name || '').toLowerCase();
      const bV = field === 'name' ? (bS?.full_name || '').toLowerCase() : (bS?.department_name || '').toLowerCase();
      return dir === 'desc' ? bV.localeCompare(aV) : aV.localeCompare(bV);
    });

    const data: StaffRowData[] = filtered.map(struct => {
      const staffId  = typeof struct.staff === 'number' ? struct.staff : (struct.staff as any).id;
      const existing = payrollMap[staffId] || null;

      const allowances: DynamicRow[] = Object.entries(existing?.additional_income || {})
        .filter(([, v]) => parseFloat(v as string) > 0)
        .map(([name, v]) => ({ id: genRowId(), name, amount: parseFloat(v as string) }));

      const deductions: DynamicRow[] = Object.entries(existing?.other_deductions || {})
        .filter(([, v]) => parseFloat(v as string) > 0)
        .map(([name, v]) => ({ id: genRowId(), name, amount: parseFloat(v as string) }));

      // FIX: use backend stored values for processed records; local calc only for unprocessed
      const preview: CalculationResult = existing
        ? {
            grossIncomeMonthly:        parseFloat(existing.gross_salary)               || 0,
            totalAdditionalAllowances: parseFloat(existing.total_income)               || 0,
            totalStatutoryDeductions:  parseFloat(existing.total_statutory_deductions) || 0,
            monthlyTax:                parseFloat(existing.monthly_tax)                || 0,
            totalOtherDeductions:      parseFloat(existing.total_other_deductions)     || 0,
            netSalary:                 parseFloat(existing.net_salary)                 || 0,
          }
        : calculateSalary(
            parseFloat(struct.monthly_salary as any),
            settings,
            (struct as any).additional_field_values ?? {},
            0,
            Object.fromEntries(allowances.map(a => [a.name, a.amount])),
            Object.fromEntries(deductions.map(d => [d.name, d.amount])),
          );

      const autoAllowances = Object.entries(existing?.allowances_breakdown || {})
        .map(([name, a]: [string, any]) => ({ name, amount: parseFloat(a?.amount ?? a) || 0 }))
        .filter(a => a.amount > 0);

      // NEW: amount_paid logic.
      // If a real (>0) amount_paid already exists on the saved record, lock it — never
      // recalculate it again. Otherwise default it to the current take-home (net salary),
      // which will keep re-syncing as allowances/deductions change until it's actually saved.
      const savedAmountPaid    = parseFloat(existing?.amount_paid) || 0;
      const amountPaidLocked   = savedAmountPaid > 0;

      return {
        structure:      struct,
        bank_name:      bankMap[staffId] || 'N/A',
        allowances,
        deductions,
        autoAllowances,
        monthlyTax:     preview.monthlyTax,
        amount_paid:        amountPaidLocked ? savedAmountPaid : preview.netSalary,
        amount_paid_locked: amountPaidLocked,
        is_paid:        existing?.payment_status === 'paid',
        record_id:      existing?.id ?? null,
        preview,
        checked:        false,
      };
    });

    setStaffData(data);
  }, [structures, settings, search, deptFilter, bankFilter, sortBy, bankMap, payrollMap]);

  useEffect(() => { processStructures(); }, [processStructures]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(processStructures, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  // ── Recalc helper (unprocessed staff only) ────────────────────────────────
  const recalc = useCallback((
    d: StaffRowData,
    allowances = d.allowances,
    deductions = d.deductions,
  ): CalculationResult => {
    if (d.is_paid || !settings) return d.preview; // never recalc paid records
    return calculateSalary(
      parseFloat(d.structure.monthly_salary as any),
      settings,
      (d.structure as any).additional_field_values ?? {},
      0,
      Object.fromEntries(allowances.map(a => [a.name, a.amount])),
      Object.fromEntries(deductions.map(x => [x.name, x.amount])),
    );
  }, [settings]);

  // ── Checkbox ──
  const handleCheckChange = (id: number) =>
    setStaffData(prev => prev.map(d => d.structure.id === id ? { ...d, checked: !d.checked } : d));

  const handleSelectAll = () =>
    setStaffData(prev => prev.map(d => ({ ...d, checked: d.is_paid ? false : true })));

  // ── Amount Paid (manual override, only effective while unlocked) ──
  const handleAmountPaidChange = (structureId: number, value: number) =>
    setStaffData(prev => prev.map(d =>
      d.structure.id === structureId && !d.amount_paid_locked ? { ...d, amount_paid: value } : d
    ));

  // ── Allowances ──
  const handleAddAllowance = (name: string, amount: number) => {
    setStaffData(prev => prev.map(d => {
      if (d.structure.id !== allwModal.structureId) return d;
      if (d.allowances.find(a => a.name === name)) { showToast('error', 'Allowance already added.'); return d; }
      const allowances = [...d.allowances, { id: genRowId(), name, amount }];
      const preview = recalc(d, allowances);
      return {
        ...d,
        allowances,
        preview,
        // NEW: resync amount_paid to the new take-home unless already locked by a saved payment
        amount_paid: d.amount_paid_locked ? d.amount_paid : preview.netSalary,
      };
    }));
    setAllwModal({ open: false, structureId: 0 });
  };
  const handleRemoveAllowance = (structureId: number, rowId: string) =>
    setStaffData(prev => prev.map(d => {
      if (d.structure.id !== structureId) return d;
      const allowances = d.allowances.filter(a => a.id !== rowId);
      const preview = recalc(d, allowances);
      return {
        ...d,
        allowances,
        preview,
        amount_paid: d.amount_paid_locked ? d.amount_paid : preview.netSalary,
      };
    }));

  // ── Deductions ──
  const handleAddDeduction = (name: string, amount: number) => {
    setStaffData(prev => prev.map(d => {
      if (d.structure.id !== dedModal.structureId) return d;
      if (d.deductions.find(x => x.name === name)) { showToast('error', 'Deduction already added.'); return d; }
      const deductions = [...d.deductions, { id: genRowId(), name, amount }];
      const preview = recalc(d, d.allowances, deductions);
      return {
        ...d,
        deductions,
        preview,
        amount_paid: d.amount_paid_locked ? d.amount_paid : preview.netSalary,
      };
    }));
    setDedModal({ open: false, structureId: 0 });
  };
  const handleRemoveDeduction = (structureId: number, rowId: string) =>
    setStaffData(prev => prev.map(d => {
      if (d.structure.id !== structureId) return d;
      const deductions = d.deductions.filter(x => x.id !== rowId);
      const preview = recalc(d, d.allowances, deductions);
      return {
        ...d,
        deductions,
        preview,
        amount_paid: d.amount_paid_locked ? d.amount_paid : preview.netSalary,
      };
    }));

  // ── Bulk Process (no payment) ──
  const handleBulkProcess = async () => {
    const selected = staffData.filter(d => d.checked && !d.is_paid);
    if (selected.length === 0) { showToast('error', 'Please select at least one unpaid staff member.'); return; }
    setSaving(true);
    try {
      const payload = selected.map(d => ({
        structure_id:      d.structure.id,
        month, year,
        bonus:             '0.00',
        additional_income: Object.fromEntries(d.allowances.map(a => [a.name, a.amount])),
        custom_deductions: Object.fromEntries(d.deductions.map(x => [x.name, x.amount])),
        amount_paid:       '0.00',
      }));
      const res        = await payrollAPI.process(payload) as any;
      const resultData = res?.data?.results ?? res?.results ?? [];
      const failures   = resultData.filter((r: any) => !r.success);
      const successes  = resultData.filter((r: any) => r.success);
      if (failures.length > 0) {
        showToast('error', `${failures.length} failed: ${failures.map((r: any) => r.error || 'Unknown').join('; ')}`);
      } else {
        showToast('success', `Successfully processed ${successes.length} payslip${successes.length !== 1 ? 's' : ''}.`);
        fetchData();
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk Save & Pay (NEW) ──
  const handleBulkSaveAndPay = async () => {
    const selected = staffData.filter(d => d.checked && !d.is_paid);
    if (selected.length === 0) { showToast('error', 'Please select at least one unpaid staff member.'); return; }
    setSaving(true);
    try {
      const payload = selected.map(d => ({
        structure_id:      d.structure.id,
        month, year,
        bonus:             '0.00',
        additional_income: Object.fromEntries(d.allowances.map(a => [a.name, a.amount])),
        custom_deductions: Object.fromEntries(d.deductions.map(x => [x.name, x.amount])),
        amount_paid:       d.amount_paid.toString(),
      }));
      const res        = await payrollAPI.process(payload) as any;
      const resultData = res?.data?.results ?? res?.results ?? [];
      const failures   = resultData.filter((r: any) => !r.success);
      const successes  = resultData.filter((r: any) => r.success);
      if (failures.length > 0) {
        showToast('error', `${failures.length} failed: ${failures.map((r: any) => r.error || 'Unknown').join('; ')}`);
      } else {
        showToast('success', `Successfully paid ${successes.length} staff member${successes.length !== 1 ? 's' : ''}.`);
        fetchData();
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => { setDeptFilter(''); setBankFilter(''); setSearch(''); setSortBy('name_asc'); setPaidFilter('all'); };
  const hasFilters   = !!(search || deptFilter || bankFilter || sortBy !== 'name_asc' || paidFilter !== 'all');

  const visibleData = useMemo(() => {
    if (paidFilter === 'paid')   return staffData.filter(d => d.is_paid);
    if (paidFilter === 'unpaid') return staffData.filter(d => !d.is_paid);
    return staffData;
  }, [staffData, paidFilter]);

  const selectedCount = staffData.filter(d => d.checked && !d.is_paid).length;
  const totalNetPay   = visibleData.reduce((s, d) => s + d.preview.netSalary, 0);
  const paidCount     = staffData.filter(d => d.is_paid).length;
  const unpaidCount   = staffData.filter(d => !d.is_paid).length;

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="text-sm text-slate-400 font-medium">Loading payroll data…</span>
    </div>
  );
  if (pageError) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{pageError}</p>
        <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-24">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <Layers className="h-5 w-5 text-white" />
          </div>
          Bulk Payslips
        </h1>
        <p className="text-sm text-slate-400 mt-1 pl-12">
          {new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })} — Payroll Processing
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Eligible', value: structures.length,     color: 'from-blue-500 to-blue-600',     Icon: Layers },
          { label: 'Paid',           value: paidCount,             color: 'from-emerald-500 to-green-600', Icon: CheckCheck },
          { label: 'Unpaid',         value: unpaidCount,           color: 'from-amber-500 to-orange-500',  Icon: Loader },
          { label: 'Total Net Pay',  value: fmtMoney(totalNetPay), color: 'from-indigo-500 to-purple-600', Icon: DollarSign },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 w-full min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or staff ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${deptFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${bankFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <select value={paidFilter} onChange={e => setPaidFilter(e.target.value as any)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${paidFilter !== 'all' ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${sortBy !== 'name_asc' ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="dept_asc">Department (A-Z)</option>
              <option value="dept_desc">Department (Z-A)</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {visibleData.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Layers className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No staff match your filters' : 'No active salary structures found'}
            </h3>
            <p className="text-sm text-slate-400">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Ensure staff have active salary structures first.'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {visibleData.map(d => (
              <StaffRow
                key={d.structure.id}
                data={d}
                onCheckChange={handleCheckChange}
                onOpenDeductionModal={id => setDedModal({ open: true, structureId: id })}
                onOpenAllowanceModal={id => setAllwModal({ open: true, structureId: id })}
                onRemoveDeduction={handleRemoveDeduction}
                onRemoveAllowance={handleRemoveAllowance}
                onViewPayslip={recordId => router.push(`/dashboard/staff/salary/payslips/${recordId}`)}
                onAmountPaidChange={handleAmountPaidChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-600">{visibleData.length}</span> showing ·{' '}
            <span className="text-emerald-600 font-medium">{paidCount} paid</span> ·{' '}
            <span className="text-amber-600 font-medium">{unpaidCount} unpaid</span>
            {selectedCount > 0 && <> · <span className="text-blue-600 font-semibold">{selectedCount} selected</span></>}
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={handleSelectAll}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              <CheckCheck className="h-4 w-4" /> Select All Unpaid
            </button>
            <button onClick={handleBulkProcess} disabled={selectedCount === 0 || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing… ({selectedCount})</>
                : <><Play className="h-4 w-4" /> Process Selected ({selectedCount})</>}
            </button>
            {/* NEW: Save & Pay Selected — processes AND marks paid using each row's amount_paid */}
            <button onClick={handleBulkSaveAndPay} disabled={selectedCount === 0 || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl shadow-sm transition-all disabled:opacity-50">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Paying… ({selectedCount})</>
                : <><DollarSign className="h-4 w-4" /> Save & Pay Selected ({selectedCount})</>}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddRowModal
        open={allwModal.open}
        onClose={() => setAllwModal({ open: false, structureId: 0 })}
        onSubmit={handleAddAllowance}
        title="Add Allowance"
        color="green"
        typeOptions={allowanceOptions}
      />
      <AddRowModal
        open={dedModal.open}
        onClose={() => setDedModal({ open: false, structureId: 0 })}
        onSubmit={handleAddDeduction}
        title="Add Deduction"
        color="red"
        typeOptions={deductionOptions}
      />
    </div>
  );
}