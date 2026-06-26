'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, salarySettingsAPI, staffBankDetailsAPI } from '@/lib/salary_management.service';
import { SalaryStructure, SalarySetting, StaffBankDetail } from '@/lib/salary_management.types';
import {
  ArrowLeft,
  Edit3,
  AlertCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  Landmark,
  Calculator,
  Calendar,
  User,
  Building2,
  BadgeCheck,
  Lock,
  PauseCircle,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

const labelCls = 'text-xs font-semibold text-slate-400 uppercase tracking-wide';
const valueCls = 'text-sm font-semibold text-slate-800 mt-0.5';

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon, iconBg, title, subtitle, action }: {
  icon: React.ReactNode; iconBg: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-50">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Collapsible section ───────────────────────────────────────────────────────
function CollapsibleCard({ icon, iconBg, title, subtitle, defaultOpen = true, children }: {
  icon: React.ReactNode; iconBg: string; title: string; subtitle?: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="text-slate-400 flex-shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && <div className="px-6 py-5">{children}</div>}
    </Card>
  );
}

// ─── Salary Calculation Engine (same as create/edit) ─────────────────────────
function calculateSalary(monthlySalary: number, setting: SalarySetting, additionalValues: Record<string, number>) {
  monthlySalary = Math.round(monthlySalary * 100) / 100;
  const annualSalary = Math.round(monthlySalary * 12 * 100) / 100;

  const basicComponents: Record<string, any> = {};
  if (setting.basic_components) {
    Object.values(setting.basic_components).forEach((component: any) => {
      const percentage = parseFloat(component.percentage) || 0;
      const monthly = Math.round(((monthlySalary * percentage) / 100) * 100) / 100;
      basicComponents[component.code] = { name: component.name, code: component.code, percentage, monthly, annual: Math.round(monthly * 12 * 100) / 100 };
    });
  }

  function calculateBaseAmount(basedOn: string, basedOnType: string): number {
    if (basedOnType === 'additional_field') return additionalValues[basedOn] || 0;
    const upper = basedOn.toUpperCase();
    if (upper === 'TOTAL') return monthlySalary;
    if (upper === 'GROSS_INCOME') return 0;
    return upper.split('+').map((c) => c.trim()).reduce((t, code) => t + (basicComponents[code]?.monthly || 0), 0);
  }

  let leaveAllowancePercentage = 0, leaveAllowanceMonthly = 0, leaveAllowanceAnnual = 0;
  if (setting.leave_allowance_percentage !== undefined) {
    leaveAllowancePercentage = parseFloat(setting.leave_allowance_percentage as any) || 0;
    const annualBasic = Object.values(basicComponents).reduce((s: number, c: any) => s + c.annual, 0);
    leaveAllowanceAnnual = Math.round(((annualBasic * leaveAllowancePercentage) / 100) * 100) / 100;
    leaveAllowanceMonthly = Math.round((leaveAllowanceAnnual / 12) * 100) / 100;
  }

  const allowances: Array<{ name: string; monthly: number; annual: number }> = [];
  let totalOtherMonthly = 0, totalOtherAnnual = 0;
  if (setting.allowances) {
    setting.allowances.forEach((a: any) => {
      if (a.is_active === false) return;
      const base = calculateBaseAmount(a.based_on || 'TOTAL', a.based_on_type || 'component');
      let monthly = 0;
      if (a.calculation_type === 'fixed') monthly = parseFloat(a.fixed_amount) || 0;
      else if (a.calculation_type === 'percentage') monthly = (base * (parseFloat(a.percentage) || 0)) / 100;
      else if (a.calculation_type === 'combined') monthly = (base * (parseFloat(a.percentage) || 0)) / 100 + (parseFloat(a.fixed_amount) || 0);
      monthly = Math.round(monthly * 100) / 100;
      const annual = Math.round(monthly * 12 * 100) / 100;
      allowances.push({ name: a.name, monthly, annual });
      totalOtherMonthly += monthly;
      totalOtherAnnual += annual;
    });
  }

  const grossIncomeMonthly = setting.include_leave_in_gross
    ? Math.round((monthlySalary + totalOtherMonthly + leaveAllowanceMonthly) * 100) / 100
    : Math.round((monthlySalary + totalOtherMonthly) * 100) / 100;
  const grossIncomeAnnual = setting.include_leave_in_gross
    ? Math.round((annualSalary + totalOtherAnnual + leaveAllowanceAnnual) * 100) / 100
    : Math.round((annualSalary + totalOtherAnnual) * 100) / 100;

  const statutoryDeductions: any[] = [];
  let totalStatutoryDeductions = 0;
  if (setting.statutory_deductions) {
    setting.statutory_deductions.forEach((d: any) => {
      if (d.is_active === false) return;
      const base = calculateBaseAmount(d.based_on || 'B', d.based_on_type || 'component');
      let amount = 0;
      if (d.calculation_type === 'percentage') amount = (base * (parseFloat(d.percentage) || 0)) / 100;
      else if (d.calculation_type === 'fixed') amount = parseFloat(d.fixed_amount) || 0;
      else if (d.calculation_type === 'combined') amount = (base * (parseFloat(d.percentage) || 0)) / 100 + (parseFloat(d.fixed_amount) || 0);
      amount = Math.round(amount * 100) / 100;
      statutoryDeductions.push({ name: d.name, monthly: amount, annual: Math.round(amount * 12 * 100) / 100, percentage: parseFloat(d.percentage) || null, basedOn: d.based_on, basedOnType: d.based_on_type, calcType: d.calculation_type });
      totalStatutoryDeductions += amount;
    });
  }

  const reliefs: Array<{ name: string; amount: number }> = [];
  let totalReliefs = 0;
  if (setting.reliefs_exemptions) {
    setting.reliefs_exemptions.forEach((r: any) => {
      if (r.is_active === false) return;
      const calcType = r.calculation_type || (r.formula_type === 'percentage_plus_fixed' ? 'combined' : r.formula_type || 'fixed');
      const basedOn = r.based_on || 'gross_income';
      const base = basedOn === 'gross_income' ? grossIncomeAnnual : calculateBaseAmount(basedOn, r.based_on_type || 'component') * 12;
      let amount = 0;
      if (calcType === 'percentage') amount = (base * (parseFloat(r.percentage) || 0)) / 100;
      else if (calcType === 'fixed') amount = parseFloat(r.fixed_amount) || 0;
      else if (calcType === 'combined') amount = (base * (parseFloat(r.percentage) || 0)) / 100 + (parseFloat(r.fixed_amount) || 0);
      amount = Math.round(amount * 100) / 100;
      reliefs.push({ name: r.name, amount });
      totalReliefs += amount;
    });
  }
  statutoryDeductions.forEach((d) => { totalReliefs += d.annual; });

  const taxableIncome = Math.round((grossIncomeAnnual - totalReliefs) * 100) / 100;
  let annualTax = 0;
  const taxBreakdown: Array<{ description: string; rate: number; amount: number }> = [];
  if (setting.tax_brackets?.length) {
    let remaining = taxableIncome;
    setting.tax_brackets.forEach((bracket: any, idx: number) => {
      if (remaining <= 0) return;
      const size = bracket.limit != null ? parseFloat(bracket.limit) : remaining;
      const taxable = Math.min(remaining, size);
      const rate = parseFloat(bracket.rate) || 0;
      const tax = Math.round(((taxable * rate) / 100) * 100) / 100;
      if (taxable > 0) {
        taxBreakdown.push({
          description: idx === 0 ? `First ${fmtMoney(size)} @ ${rate}%` : bracket.limit == null ? `Remaining ${fmtMoney(taxable)} @ ${rate}%` : `Next ${fmtMoney(size)} @ ${rate}%`,
          rate, amount: tax,
        });
        annualTax += tax;
        remaining -= taxable;
      }
    });
  }

  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;
  const effectiveTaxRate = grossIncomeMonthly > 0 ? Math.round(((monthlyTax / grossIncomeMonthly) * 100) * 100) / 100 : 0;
  const netSalary = Math.round((grossIncomeMonthly - monthlyTax) * 100) / 100;

  return { basicComponents, leaveAllowancePercentage, leaveAllowanceMonthly, leaveAllowanceAnnual, allowances, grossIncomeMonthly, grossIncomeAnnual, reliefs, totalReliefs, taxableIncome, taxBreakdown, annualTax, monthlyTax, effectiveTaxRate, netSalary, statutoryDeductions, totalStatutoryDeductions };
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalaryStructureDetailPage() {
  const router = useRouter();
  const params = useParams();
  const structureId = Number(params.id);
  const { user, hasPermission } = useAuth();

  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [setting, setSetting] = useState<SalarySetting | null>(null);
  const [bankDetail, setBankDetail] = useState<StaffBankDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await salaryStructuresAPI.get(structureId);
      setStructure(s);

      // Resolve salary setting
      let resolvedSetting: SalarySetting | null = null;
      if (typeof s.salary_setting === 'object' && s.salary_setting !== null) {
        resolvedSetting = s.salary_setting as SalarySetting;
      } else {
        // fetch if only an id was returned
        try {
          const settings = await salarySettingsAPI.list();
          const list = Array.isArray(settings) ? settings : (settings as any)?.results || [];
          const ssid = typeof s.salary_setting === 'number' ? s.salary_setting : (s.salary_setting as any)?.id;
          resolvedSetting = list.find((x: SalarySetting) => x.id === ssid) || null;
        } catch { /* non-fatal */ }
      }
      setSetting(resolvedSetting);

      // Load bank details
      const staffId = typeof s.staff === 'object' ? (s.staff as any).id : s.staff;
      try {
        const results = await staffBankDetailsAPI.list({ staff: staffId });
        const record = Array.isArray(results) ? results[0] : (results as any)?.data?.[0];
        setBankDetail(record || null);
      } catch { /* non-fatal */ }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [structureId]);

  const calculation = useMemo(() => {
    if (!structure || !setting) return null;
    return calculateSalary(
      parseFloat(structure.monthly_salary) || 0,
      setting,
      structure.additional_field_values || {},
    );
  }, [structure, setting]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading salary structure…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !structure) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load structure</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const staffDetail = (structure as any).staff_detail;
  const staffName = staffDetail?.full_name || (structure as any).staff_name || `Staff #${structure.staff}`;
  const staffIdDisplay = staffDetail?.staff_id || null;
  const deptName = staffDetail?.department_name || null;
  const positionName = staffDetail?.position_name || null;
  const settingName = (structure as any).salary_setting_name || (setting?.name) || '—';
  const isLocked = setting?.is_locked;
  const isSettingActive = setting?.is_active;

  return (
    <div className="space-y-4 pb-10">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/salary/structure')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              Salary Structure
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">{staffName} — {settingName}</p>
          </div>
        </div>

        {canEdit && !isLocked && (
          <button
            onClick={() => router.push(`/dashboard/staff/salary/structure/${structureId}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm shadow-amber-200"
          >
            <Edit3 className="h-4 w-4" /> Edit Structure
          </button>
        )}
        {isLocked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl">
            <Lock className="h-3.5 w-3.5" /> Locked
          </span>
        )}
      </div>

      {/* ── Staff + Setting Overview ── */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-50">
          {/* Staff */}
          <div className="flex items-start gap-4 p-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
              <User className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className={labelCls}>Staff Member</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{staffName}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {staffIdDisplay && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{staffIdDisplay}</span>
                )}
                {deptName && (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {deptName}
                  </span>
                )}
                {positionName && (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{positionName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Setting */}
          <div className="flex items-start gap-4 p-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
              <Calculator className="h-6 w-6 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={labelCls}>Salary Setting</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{settingName}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                ) : isSettingActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                    <BadgeCheck className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                    <PauseCircle className="h-3 w-3" /> Inactive
                  </span>
                )}
                {structure.is_active ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Structure Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Structure Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dates + Monthly row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-slate-50 divide-x divide-slate-50">
          {[
            { label: 'Monthly Salary', value: fmtMoney(structure.monthly_salary) },
            { label: 'Annual Salary', value: fmtMoney(structure.annual_salary || parseFloat(structure.monthly_salary) * 12) },
            { label: 'Effective From', value: new Date(structure.effective_from).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) },
            { label: 'Effective To', value: structure.effective_to ? new Date(structure.effective_to).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Indefinite' },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4">
              <p className={labelCls}>{label}</p>
              <p className={valueCls}>{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Bank Details ── */}
      {bankDetail && (
        <CollapsibleCard
          icon={<Landmark className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-cyan-500 to-teal-600"
          title="Bank Details"
          subtitle={`${bankDetail.bank_name} — ${bankDetail.account_name}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            {[
              { label: 'Bank Name', value: bankDetail.bank_name },
              { label: 'Bank Code', value: bankDetail.bank_code || '—' },
              { label: 'Account Number', value: bankDetail.account_number || '—' },
              { label: 'Account Name', value: bankDetail.account_name },
              { label: 'Beneficiary Code', value: bankDetail.beneficiary_code || '—' },
              { label: 'Branch Sort Code', value: bankDetail.branch_sort_code || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className={labelCls}>{label}</p>
                <p className={valueCls}>{value}</p>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── Additional Fields ── */}
      {setting?.additional_fields && setting.additional_fields.length > 0 && structure.additional_field_values && (
        <CollapsibleCard
          icon={<Plus className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-purple-500 to-purple-700"
          title="Additional Salary Profile Fields"
          subtitle={`From "${settingName}"`}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            {setting.additional_fields.map((field: any) => (
              <div key={field.code}>
                <p className={labelCls}>{field.name}</p>
                <p className={valueCls}>{fmtMoney(structure.additional_field_values?.[field.code] || 0)}</p>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── Calculation ── */}
      {calculation ? (
        <Card>
          <CardHeader
            icon={<Calculator className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
            title="Complete Salary Calculation"
            subtitle={`Based on ${settingName}`}
            action={
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">Complete</span>
            }
          />

          <div className="p-6 space-y-6">
            {/* Salary & Leave */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Salary & Leave Allowance</h4>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-2.5 border border-slate-200 font-semibold text-slate-600">Description</th>
                    <th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Monthly (₦)</th>
                    <th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Annual (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border border-slate-200 font-medium">Salary</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(structure.monthly_salary)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(parseFloat(structure.monthly_salary) * 12)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-slate-200 font-medium">Leave Allowance</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.leaveAllowanceMonthly)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.leaveAllowanceAnnual)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Income Breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Income Breakdown</h4>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-emerald-50">
                    <th colSpan={4} className="text-center p-2.5 border border-slate-200 font-semibold text-emerald-700">INCOME BREAKDOWN</th>
                  </tr>
                  <tr className="bg-slate-50">
                    <th className="text-left p-2.5 border border-slate-200 font-semibold text-slate-600">Description</th>
                    <th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Monthly (₦)</th>
                    <th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Annual (₦)</th>
                    <th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(calculation.basicComponents).map((comp: any) => (
                    <tr key={comp.code}>
                      <td className="p-2.5 border border-slate-200">{comp.name}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(comp.monthly)}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(comp.annual)}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{comp.percentage.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {calculation.allowances.map((a) => (
                    <tr key={a.name}>
                      <td className="p-2.5 border border-slate-200">{a.name}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(a.monthly)}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(a.annual)}</td>
                      <td className="p-2.5 border border-slate-200 text-right">
                        {parseFloat(structure.monthly_salary) > 0
                          ? ((a.monthly / parseFloat(structure.monthly_salary)) * 100).toFixed(2)
                          : '0.00'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Gross */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-emerald-700">GROSS INCOME (ANNUAL)</span>
              <span className="font-bold text-emerald-700 text-lg">{fmtMoney(calculation.grossIncomeAnnual)}</span>
            </div>

            {/* Relief */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Relief & Exemption</h4>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-amber-50">
                    <th colSpan={2} className="text-center p-2.5 border border-slate-200 font-semibold text-amber-700">RELIEF & EXEMPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {calculation.statutoryDeductions.map((d) => (
                    <tr key={d.name}>
                      <td className="p-2.5 border border-slate-200">{d.name}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(d.annual)}</td>
                    </tr>
                  ))}
                  {calculation.reliefs.map((r) => (
                    <tr key={r.name}>
                      <td className="p-2.5 border border-slate-200">{r.name}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 font-bold">
                    <td className="p-2.5 border border-slate-200">Tax Free Pay (Total Relief)</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.totalReliefs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PAYE */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">PAYE Tax Calculation</h4>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-red-50">
                    <th colSpan={3} className="text-center p-2.5 border border-slate-200 font-semibold text-red-700">PAYE TAX CALCULATION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border border-slate-200">Annual Gross Income</td>
                    <td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.grossIncomeAnnual)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-slate-200">Less: Tax Free Pay</td>
                    <td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.totalReliefs)}</td>
                  </tr>
                  <tr className="bg-amber-50 font-bold">
                    <td className="p-2.5 border border-slate-200">Taxable Income</td>
                    <td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.taxableIncome)}</td>
                  </tr>
                  {calculation.taxBreakdown.map((b, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 border border-slate-200">{b.description}</td>
                      <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(b.amount)}</td>
                      <td className="p-2.5 border border-slate-200 text-center text-xs text-slate-500">{b.rate}%</td>
                    </tr>
                  ))}
                  <tr className="bg-red-50 font-bold">
                    <td className="p-2.5 border border-slate-200">Total PAYE (Annual)</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.annualTax)}</td>
                    <td className="p-2.5 border border-slate-200 text-right text-sm">{fmtMoney(calculation.monthlyTax)} / month</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Summary</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Monthly Income</span><strong>{fmtMoney(calculation.grossIncomeMonthly)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Monthly PAYE Tax</span><strong>{fmtMoney(calculation.monthlyTax)}</strong></div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-emerald-700 font-semibold">Net Salary</span>
                    <strong className="text-emerald-700 text-base">{fmtMoney(calculation.netSalary)}</strong>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Effective Tax Rate</span><strong className="text-blue-600">{calculation.effectiveTaxRate.toFixed(2)}%</strong></div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Annual Summary</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Annual Gross</span><strong>{fmtMoney(calculation.grossIncomeAnnual)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tax Free Pay</span><strong>{fmtMoney(calculation.totalReliefs)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Taxable Income</span><strong>{fmtMoney(calculation.taxableIncome)}</strong></div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-red-600 font-semibold">Total PAYE Tax</span>
                    <strong className="text-red-600">{fmtMoney(calculation.annualTax)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="p-10 text-center text-slate-400">
            <Calculator className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm">Salary calculation unavailable — salary setting could not be loaded.</p>
          </div>
        </Card>
      )}

      {/* ── Bottom actions ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/salary/structure')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to List
        </button>
        {canEdit && !isLocked && (
          <button
            onClick={() => router.push(`/dashboard/staff/salary/structure/${structureId}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all shadow-sm"
          >
            <Edit3 className="h-4 w-4" /> Edit Structure
          </button>
        )}
      </div>
    </div>
  );
}