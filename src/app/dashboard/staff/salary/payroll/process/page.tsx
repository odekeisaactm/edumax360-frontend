'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, payrollAPI, salarySettingsAPI } from '@/lib/salary_management.service';
import { SalaryStructure, SalaryRecord, SalarySetting } from '@/lib/salary_management.types';
import {
  FileText, ArrowLeft, Save, X, AlertCircle, Loader2, CheckCircle,
  Plus, Trash2, Info, DollarSign, UserCircle, Building2, Gift, MinusCircle, Shield, Calculator,
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
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

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

// ─── Types for dynamic rows ────────────────────────────────────────────────────
interface DynamicRow { id: string; name: string; amount: number; }
let rowIdCounter = 0;
const genRowId = () => `row-${++rowIdCounter}`;

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ icon, iconBg, title, children, badge }: {
  icon: React.ReactNode; iconBg: string; title: string; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>{icon}</div>
          <h5 className="text-sm font-bold text-slate-800">{title}</h5>
        </div>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProcessPayrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const structureId = Number(searchParams.get('structureId'));
  const month = Number(searchParams.get('month'));
  const year = Number(searchParams.get('year'));

  const canManage = user?.is_superuser || hasPermission('finance.add_salaryrecord');

  // ── State ──
  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [setting, setSetting] = useState<SalarySetting | null>(null);
  const [existingRecord, setExistingRecord] = useState<SalaryRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [bonus, setBonus] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [allowances, setAllowances] = useState<DynamicRow[]>([]);
  const [deductions, setDeductions] = useState<DynamicRow[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Fetch Data ──
  useEffect(() => {
    if (!structureId || !month || !year) {
      setPageError('Missing required parameters (structureId, month, or year).');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setPageError(null);
      try {
        const structData = await salaryStructuresAPI.get(structureId);
        setStructure(structData);

        const settingId = typeof structData.salary_setting === 'number' ? structData.salary_setting : (structData.salary_setting as any).id;
        const settingData = await salarySettingsAPI.get(settingId);
        setSetting(settingData);

        const staffId = typeof structData.staff === 'object' ? (structData.staff as any).id : structData.staff;
        const recordsRes = await payrollAPI.listRecords({ month, year, staff: staffId }) as any;
        const records = recordsRes?.results ?? recordsRes?.data ?? recordsRes ?? [];
        const existing = Array.isArray(records) ? records.find((r: any) => {
          const rStaffId = typeof r.staff === 'object' ? (r.staff as any).id : r.staff;
          return rStaffId === staffId;
        }) : null;

        if (existing) {
          setExistingRecord(existing);
          setBonus(parseFloat(existing.bonus) || 0);
          setNotes(existing.notes || '');

          const existingAllowances = existing.additional_income || {};
          setAllowances(Object.entries(existingAllowances)
            .filter(([, val]) => parseFloat(val as string) > 0)
            .map(([name, val]) => ({ id: genRowId(), name, amount: parseFloat(val as string) })));

          const existingDeductions = existing.other_deductions || {};
          setDeductions(Object.entries(existingDeductions)
            .filter(([, val]) => parseFloat(val as string) > 0)
            .map(([name, val]) => ({ id: genRowId(), name, amount: parseFloat(val as string) })));
        }
      } catch (err) {
        setPageError(extractError(err));
      } finally {
        setLoading(false);
      }
    };

    if (canManage) fetchData();
  }, [structureId, month, year, canManage]);

  // ── Dynamic Row Handlers ──
  const addAllowance = (name: string) => {
    if (allowances.find(a => a.name === name)) return showToast('error', 'Allowance already added.');
    setAllowances(prev => [...prev, { id: genRowId(), name, amount: 0 }]);
  };
  const removeAllowance = (id: string) => setAllowances(prev => prev.filter(a => a.id !== id));
  const updateAllowance = (id: string, amount: number) => setAllowances(prev => prev.map(a => a.id === id ? { ...a, amount } : a));

  const addDeduction = (name: string) => {
    if (deductions.find(d => d.name === name)) return showToast('error', 'Deduction already added.');
    setDeductions(prev => [...prev, { id: genRowId(), name, amount: 0 }]);
  };
  const removeDeduction = (id: string) => setDeductions(prev => prev.filter(d => d.id !== id));
  const updateDeduction = (id: string, amount: number) => setDeductions(prev => prev.map(d => d.id === id ? { ...d, amount } : d));

  // ── Derived Data for Calculation ──
  const additionalIncomeDict = useMemo(() => {
    const dict: Record<string, number> = {};
    allowances.forEach(a => { if (a.amount > 0) dict[a.name] = a.amount; });
    return dict;
  }, [allowances]);

  const customDeductionsDict = useMemo(() => {
    const dict: Record<string, number> = {};
    deductions.forEach(d => { if (d.amount > 0) dict[d.name] = d.amount; });
    return dict;
  }, [deductions]);

  const additionalFieldValues = useMemo(() => structure?.additional_field_values || {}, [structure]);

  // ── Live Preview Calculation ──
  const preview = useMemo(() => {
    if (!setting || !structure) return null;
    return calculateSalary(parseFloat(structure.monthly_salary), setting, additionalFieldValues, bonus, additionalIncomeDict, customDeductionsDict);
  }, [setting, structure, additionalFieldValues, bonus, additionalIncomeDict, customDeductionsDict]);

  // ── Submit Handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structure) return;
    setSubmitting(true);
    try {
      const payload = [{
        structure_id: structure.id,
        month,
        year,
        bonus: bonus.toString(),
        additional_income: additionalIncomeDict,
        custom_deductions: customDeductionsDict,
        amount_paid: "0.00",
      }];

      const res = await payrollAPI.process(payload) as any;

      // FIX: Safely unwrap the APIResponse wrapper
      const resultData = res?.data?.results || res?.results || [];
      const result = resultData[0];

      if (result?.success) {
        showToast('success', 'Payroll processed successfully!');
        router.push(`/dashboard/staff/salary/payslips/${result.record_id}`);
      } else {
        showToast('error', result?.error || 'Failed to process payroll.');
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers for rendering ──
  const staffDetail = structure?.staff_detail as any;
  const staffName = staffDetail?.full_name || (structure?.staff as any)?.first_name || 'Staff';
  const deptName = staffDetail?.department_name || 'N/A';
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

  const manualDeductionConfigs = useMemo(() => (setting?.other_deductions_config || []).filter((d: any) => !d.linked_to), [setting]);
  const allowanceConfigs = useMemo(() => setting?.income_items || [], [setting]);

  // ── UI States ──
  if (!canManage) return <div className="p-10 text-center text-slate-500">Access Denied</div>;
  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm font-medium">Loading payroll data…</span></div>
    </div>
  );
  if (pageError || !structure || !setting) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{pageError || 'Failed to load structure or setting.'}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">Go Back</button>
      </div>
    </div>
  );

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
              <FileText className="h-5 w-5 text-white" />
            </div>
            Process Payroll - {staffName}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">{monthName} {year}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Info & Salary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section
            icon={<UserCircle className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
            title="Staff Information"
            badge={existingRecord ? <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 uppercase">Editing Existing</span> : null}
          >
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-semibold text-slate-800">{staffName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Department</span><span className="font-medium text-slate-700">{deptName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Period</span><span className="font-medium text-slate-700">{monthName} {year}</span></div>
            </div>
          </Section>

          <Section icon={<DollarSign className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-700" title="Basic Salary & Bonus">
            <p className="text-2xl font-bold text-slate-800 mb-4">{fmtMoney(structure.monthly_salary)} <span className="text-sm font-normal text-slate-400">/ month</span></p>
            <div>
              <label className={labelCls}>Bonus (₦)</label>
              <input type="number" className={inputCls} value={bonus || ''} onChange={e => setBonus(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder="0.00" />
            </div>
          </Section>
        </div>

        {/* Row 2: Basic Components (Read-only) */}
        <Section icon={<Calculator className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-violet-500 to-purple-600" title="Basic Salary Components">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                  <th className="py-2 pr-4">Component</th>
                  <th className="py-2 pr-4">Percentage</th>
                  <th className="py-2 text-right">Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(setting.basic_components || {}).map((comp: any) => {
                  const amount = (parseFloat(structure.monthly_salary) * parseFloat(comp.percentage)) / 100;
                  return (
                    <tr key={comp.code} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-700">{comp.name}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{comp.percentage}%</td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">{fmtMoney(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Row 3: Additional Allowances */}
        <Section
          icon={<Gift className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-cyan-500 to-cyan-700"
          title="Additional Allowances"
          badge={
            <div className="flex items-center gap-2">
              <select id="allowanceSelect" className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white">
                <option value="">Select allowance...</option>
                {allowanceConfigs.map((a: any) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
              <button type="button" onClick={() => {
                const sel = document.getElementById('allowanceSelect') as HTMLSelectElement;
                if (sel?.value) { addAllowance(sel.value); sel.value = ''; }
              }} className="p-1.5 rounded-lg text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          }
        >
          {allowances.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">No additional allowances added. Select and click + to add.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-2 pr-4">Allowance Name</th>
                <th className="py-2 pr-4">Amount (₦)</th>
                <th className="py-2 w-10"></th>
              </tr></thead>
              <tbody>
                {allowances.map(a => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 group">
                    <td className="py-2 pr-4 font-medium text-slate-700">{a.name}</td>
                    <td className="py-2 pr-4">
                      <input type="number" className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" value={a.amount || ''} onChange={e => updateAllowance(a.id, parseFloat(e.target.value) || 0)} step="0.01" min="0" />
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => removeAllowance(a.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 opacity-50 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Row 4: Other Deductions */}
        <Section
          icon={<MinusCircle className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-orange-500 to-red-500"
          title="Other Deductions"
          badge={
            <div className="flex items-center gap-2">
              <select id="deductionSelect" className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white">
                <option value="">Select deduction...</option>
                {manualDeductionConfigs.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
              <button type="button" onClick={() => {
                const sel = document.getElementById('deductionSelect') as HTMLSelectElement;
                if (sel?.value) { addDeduction(sel.value); sel.value = ''; }
              }} className="p-1.5 rounded-lg text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          }
        >
          {deductions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">No deductions added. Select and click + to add.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-2 pr-4">Deduction Name</th>
                <th className="py-2 pr-4">Amount (₦)</th>
                <th className="py-2 w-10"></th>
              </tr></thead>
              <tbody>
                {deductions.map(d => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0 group">
                    <td className="py-2 pr-4 font-medium text-slate-700">{d.name}</td>
                    <td className="py-2 pr-4">
                      <input type="number" className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" value={d.amount || ''} onChange={e => updateDeduction(d.id, parseFloat(e.target.value) || 0)} step="0.01" min="0" />
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => removeDeduction(d.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 opacity-50 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Row 5: Live Summary Preview */}
        {preview && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-700">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <h5 className="text-sm font-bold text-slate-800">Payroll Summary (Live Preview)</h5>
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-100 ml-auto uppercase tracking-wide">Real-time</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Income Side */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">Basic Salary</span>
                  <span className="font-medium text-slate-700">{fmtMoney(structure.monthly_salary)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">Bonus</span>
                  <span className="font-medium text-slate-700">{fmtMoney(bonus)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">Additional Allowances</span>
                  <span className="font-medium text-slate-700">{fmtMoney(preview.totalAdditionalAllowances)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 bg-blue-50 -mx-5 px-5 py-3 border-y border-blue-100">
                  <span className="font-bold text-blue-800">Gross Income</span>
                  <span className="font-bold text-blue-800 text-lg">{fmtMoney(preview.grossIncomeMonthly)}</span>
                </div>
              </div>

              {/* Deductions Side */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-slate-400" /> Statutory Deductions</span>
                  <span className="font-medium text-slate-700">{fmtMoney(preview.totalStatutoryDeductions)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">PAYE Tax</span>
                  <span className="font-medium text-slate-700">{fmtMoney(preview.monthlyTax)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5"><MinusCircle className="h-3.5 w-3.5 text-slate-400" /> Other Deductions</span>
                  <span className="font-medium text-slate-700">{fmtMoney(preview.totalOtherDeductions)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 bg-green-50 -mx-5 px-5 py-3 border-y border-green-100">
                  <span className="font-bold text-green-800">Take Home Pay</span>
                  <span className="font-bold text-green-800 text-lg">{fmtMoney(preview.netSalary)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Row 6: Notes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Any notes for this payslip..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3.5 flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} disabled={submitting} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Save className="h-4 w-4" /> Save Payroll</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


// ─── calculation engine ─────────────────────────────────────────────────────
interface CalculationResult {
  grossIncomeMonthly: number;
  totalAdditionalAllowances: number;
  totalStatutoryDeductions: number;
  monthlyTax: number;
  totalOtherDeductions: number;
  netSalary: number;
}

function calculateSalary(
  monthlySalary: number, setting: SalarySetting, additionalValues: Record<string, number>,
  bonus: number = 0, additionalIncome: Record<string, number> = {}, customDeductions: Record<string, number> = {}
): CalculationResult {
  monthlySalary = Math.round(monthlySalary * 100) / 100;
  const basicComponents: Record<string, any> = {};
  if (setting.basic_components) {
    Object.values(setting.basic_components).forEach((component: any) => {
      const percentage = parseFloat(component.percentage) || 0;
      basicComponents[component.code] = { monthly: (monthlySalary * percentage) / 100 };
    });
  }

  const calculateBaseAmount = (basedOn: string, basedOnType: string): number => {
    if (basedOnType === 'additional_field') return additionalValues[basedOn] || 0;
    if (basedOn.toUpperCase() === 'TOTAL') return monthlySalary;
    const codes = basedOn.toUpperCase().split('+').map(c => c.trim());
    let total = 0;
    codes.forEach(code => { if (basicComponents[code]) total += basicComponents[code].monthly; });
    return total;
  };

  let totalAutoAllowances = 0;
  if (setting.allowances) {
    setting.allowances.forEach((allowance: any) => {
      if (allowance.is_active !== false && !allowance.annual_only) {
        const base = calculateBaseAmount(allowance.based_on || 'TOTAL', allowance.based_on_type || 'component');
        const pct = parseFloat(allowance.percentage) || 0;
        const fixed = parseFloat(allowance.fixed_amount) || 0;
        if (allowance.calculation_type === 'fixed') totalAutoAllowances += fixed;
        else if (allowance.calculation_type === 'percentage') totalAutoAllowances += (base * pct) / 100;
        else totalAutoAllowances += (base * pct) / 100 + fixed;
      }
    });
  }

  const totalAdditionalAllowances = Object.values(additionalIncome).reduce((s, v) => s + v, 0);
  const grossIncomeMonthly = monthlySalary + bonus + totalAutoAllowances + totalAdditionalAllowances;

  let totalStatutoryDeductions = 0;
  if (setting.statutory_deductions) {
    setting.statutory_deductions.forEach((ded: any) => {
      if (ded.is_active !== false) {
        const base = calculateBaseAmount(ded.based_on || 'B', ded.based_on_type || 'component');
        const pct = parseFloat(ded.percentage) || 0;
        const fixed = parseFloat(ded.fixed_amount) || 0;
        if (ded.calculation_type === 'fixed') totalStatutoryDeductions += fixed;
        else if (ded.calculation_type === 'percentage') totalStatutoryDeductions += (base * pct) / 100;
        else totalStatutoryDeductions += (base * pct) / 100 + fixed;
      }
    });
  }

  const annualGrossForTax = (monthlySalary + bonus) * 12;
  let totalReliefs = totalStatutoryDeductions * 12;

  if (setting.reliefs_exemptions) {
    setting.reliefs_exemptions.forEach((relief: any) => {
      if (relief.is_active !== false) {
        let base = relief.based_on === 'gross_income' ? annualGrossForTax : calculateBaseAmount(relief.based_on || 'B', relief.based_on_type || 'component') * 12;
        const pct = parseFloat(relief.percentage) || 0;
        const fixed = parseFloat(relief.fixed_amount) || 0;
        if (relief.calculation_type === 'fixed') totalReliefs += fixed;
        else if (relief.calculation_type === 'percentage') totalReliefs += (base * pct) / 100;
        else totalReliefs += (base * pct) / 100 + fixed;
      }
    });
  }

  const taxableIncome = Math.max(0, annualGrossForTax - totalReliefs);
  let annualTax = 0;
  let remainingIncome = taxableIncome;

  if (setting.tax_brackets) {
    setting.tax_brackets.forEach((bracket: any) => {
      if (remainingIncome > 0) {
        const limit = bracket.limit !== null && bracket.limit !== undefined ? parseFloat(bracket.limit) : remainingIncome;
        const taxableAmount = Math.min(remainingIncome, limit);
        annualTax += (taxableAmount * (parseFloat(bracket.rate) || 0)) / 100;
        remainingIncome -= taxableAmount;
      }
    });
  }
  const monthlyTax = annualTax / 12;
  const totalOtherDeductions = Object.values(customDeductions).reduce((s, v) => s + v, 0);
  const netSalary = grossIncomeMonthly - totalStatutoryDeductions - monthlyTax - totalOtherDeductions;

  return { grossIncomeMonthly, totalAdditionalAllowances, totalStatutoryDeductions, monthlyTax, totalOtherDeductions, netSalary };
}