'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, salarySettingsAPI, staffBankDetailsAPI, salaryGlobalSettingsAPI } from '@/lib/salary_management.service';
import { staffAPI } from '@/lib/api';
import { SalarySetting, SalaryStructure, SalaryStructureWrite, StaffBankDetail, StaffBankDetailWrite } from '@/lib/salary_management.types';
import { Staff } from '@/lib/types';
import { ArrowLeft, Save, X, AlertCircle, Loader2, CheckCircle, ChevronDown, ChevronUp, Plus, Info, DollarSign, Landmark, Calculator, Search, ChevronRight, Check, Edit3, Settings } from 'lucide-react';

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
      const msgs = Object.entries(d.details).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`).join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: number): string { return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function staffLabel(s: Staff): string {
  const name = (s as any).full_name || `${(s as any).first_name || ''} ${(s as any).last_name || ''}`.trim();
  return `${name}${(s as any).staff_id ? ` (${(s as any).staff_id})` : ''}`;
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Toast Stack ───────────────────────────────────────────────────────────────
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

// ─── Section Component ─────────────────────────────────────────────────────────
interface SectionProps { icon: React.ReactNode; iconBg: string; title: string; subtitle?: string; required?: boolean; open: boolean; onToggle: () => void; children: React.ReactNode; error?: string; }
function Section({ icon, iconBg, title, subtitle, required, open, onToggle, children, error }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle} className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left ${error ? 'bg-red-50/50' : 'hover:bg-slate-50/60'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{title}</span>
            {required && <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wide">Required</span>}
            {error && <span className="text-[10px] font-semibold text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Needs attention</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex-shrink-0 text-slate-400">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
      </button>
      {open && <div className="px-6 pb-6 border-t border-slate-50"><div className="pt-5">{children}</div></div>}
    </div>
  );
}

// ─── Accordion ──────────────────────────────────────────────────────────────────
function Accordion({ title, icon, open, onToggle, children, badge }: { title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode; badge?: React.ReactNode; }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">{icon}<span className="text-sm font-semibold text-slate-700">{title}</span>{badge}</div>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Searchable Staff Combobox ──────────────────────────────────────────────────
function StaffCombobox({ staffList, value, onChange, loading, disabled }: { staffList: Staff[]; value: number | null; onChange: (id: number | null) => void; loading?: boolean; disabled?: boolean; }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => staffList.find((s) => s.id === value) || null, [staffList, value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staffList.slice(0, 50);
    return staffList.filter((s) => staffLabel(s).toLowerCase().includes(q)).slice(0, 50);
  }, [staffList, query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handleClick); return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (s: Staff) => { onChange(s.id); setQuery(''); setOpen(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
        <input ref={inputRef} type="text" className={`${inputCls} pl-9 ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`} placeholder={loading ? 'Loading staff…' : selected ? staffLabel(selected) : 'Search staff by name or ID…'} value={open ? query : ''} onFocus={() => { if (!disabled) { setOpen(true); setHighlightIndex(0); } }} onChange={(e) => { setQuery(e.target.value); setHighlightIndex(0); }} onKeyDown={handleKeyDown} disabled={loading || disabled} autoComplete="off" />
        {selected && !open && !disabled && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); setQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? <p className="px-4 py-3 text-sm text-slate-400">No staff match "{query}".</p> : filtered.map((s, i) => (
            <button key={s.id} type="button" onClick={() => handleSelect(s)} onMouseEnter={() => setHighlightIndex(i)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${i === highlightIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}>
              <span>{staffLabel(s)}</span>{s.id === value && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
            </button>
          ))}
          {!query && staffList.length > 50 && <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">Showing first 50 — type to search all {staffList.length} staff.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Overrides Modal ────────────────────────────────────────────────────────────
function OverridesModal({ open, onClose, onApply, setting, cleanCalculation, initialAllowanceOverrides, initialDeductionOverrides }: { open: boolean; onClose: () => void; onApply: (allowances: Record<string, number>, deductions: Record<string, number>) => void; setting: SalarySetting | null; cleanCalculation: any; initialAllowanceOverrides: Record<string, number>; initialDeductionOverrides: Record<string, number>; }) {
  const [allowances, setAllowances] = useState<Record<string, number>>({});
  const [deductions, setDeductions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) { setAllowances(initialAllowanceOverrides); setDeductions(initialDeductionOverrides); }
  }, [open, initialAllowanceOverrides, initialDeductionOverrides]);

  if (!open || !setting) return null;

  const handleAllowanceChange = (name: string, value: string) => { setAllowances((prev) => { const next = { ...prev }; if (value === '') delete next[name]; else next[name] = parseFloat(value) || 0; return next; }); };
  const handleDeductionChange = (name: string, value: string) => { setDeductions((prev) => { const next = { ...prev }; if (value === '') delete next[name]; else next[name] = parseFloat(value) || 0; return next; }); };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm"><Edit3 className="h-5 w-5 text-white" /></div>
            <div><h3 className="text-base font-bold text-slate-900">Custom Flat Overrides</h3><p className="text-xs text-slate-500">Override default formula outputs for this specific staff member.</p></div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800 flex items-start gap-2 mb-6"><Info className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>Leave inputs blank to use the standard template math automatically. Typing a number locks that calculation to your custom flat amount for this user.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Allowances</h4>
              {(!setting.allowances || setting.allowances.length === 0) ? <p className="text-sm text-slate-400 italic">No allowances available to override.</p> : (
                <div className="space-y-4">
                  {setting.allowances.map((a: any) => {
                    const defaultVal = cleanCalculation?.allowances.find((ca: any) => ca.name === a.name)?.monthly || 0;
                    return (
                      <div key={a.name}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{a.name}</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span><input type="number" className={`${inputCls} pl-7`} placeholder={`Default: ${fmtMoney(defaultVal).replace('₦', '')}`} value={allowances[a.name] !== undefined ? allowances[a.name] : ''} onChange={(e) => handleAllowanceChange(a.name, e.target.value)} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Statutory Deductions</h4>
              {(!setting.statutory_deductions || setting.statutory_deductions.length === 0) ? <p className="text-sm text-slate-400 italic">No deductions available to override.</p> : (
                <div className="space-y-4">
                  {setting.statutory_deductions.map((d: any) => {
                    const defaultVal = cleanCalculation?.statutoryDeductions.find((cd: any) => cd.name === d.name)?.monthly || 0;
                    return (
                      <div key={d.name}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{d.name}</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span><input type="number" className={`${inputCls} pl-7`} placeholder={`Default: ${fmtMoney(defaultVal).replace('₦', '')}`} value={deductions[d.name] !== undefined ? deductions[d.name] : ''} onChange={(e) => handleDeductionChange(d.name, e.target.value)} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={() => { setAllowances({}); setDeductions({}); }} className="text-sm font-semibold text-slate-500 hover:text-slate-800 underline transition-colors">Clear All Overrides</button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
            <button onClick={() => onApply(allowances, deductions)} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 rounded-xl transition-colors">Apply Overrides</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Salary Preview Component ──────────────────────────────────────────────────
interface SalaryPreviewProps { setting: SalarySetting; monthlySalary: number; additionalValues: Record<string, number>; allowanceOverrides?: Record<string, number>; deductionOverrides?: Record<string, number>; onOpenOverrides: () => void; activeOverrideCount: number; allowCustomOverrides: boolean; }
function SalaryPreview({ setting, monthlySalary, additionalValues, allowanceOverrides = {}, deductionOverrides = {}, onOpenOverrides, activeOverrideCount, allowCustomOverrides }: SalaryPreviewProps) {
  const calculation = useMemo(() => calculateSalary(monthlySalary, setting, additionalValues, allowanceOverrides, deductionOverrides), [monthlySalary, setting, additionalValues, allowanceOverrides, deductionOverrides]);
  return (
    <div className="mt-4 border border-blue-200 rounded-xl overflow-hidden">
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center flex-wrap gap-3">
        <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5"><Calculator className="h-4 w-4" /> Live Calculation Preview</span>
        <div className="flex items-center gap-2">
          {allowCustomOverrides && (
            <button type="button" onClick={onOpenOverrides} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeOverrideCount > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 ring-2 ring-indigo-200 ring-offset-1 ring-offset-blue-50' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm'}`}>
              <Settings className="h-3 w-3" /> {activeOverrideCount > 0 ? `${activeOverrideCount} Override${activeOverrideCount > 1 ? 's' : ''} Applied` : 'Custom Overrides'}
            </button>
          )}
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium hidden sm:inline-flex">Auto-updated</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Salary & Leave Allowance</h4>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-slate-50"><th className="text-left p-2.5 border border-slate-200 font-semibold text-slate-600">Description</th><th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Monthly (₦)</th><th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Annual (₦)</th></tr></thead>
            <tbody>
              <tr><td className="p-2.5 border border-slate-200 font-medium">Salary</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(monthlySalary)}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(monthlySalary * 12)}</td></tr>
              <tr><td className="p-2.5 border border-slate-200 font-medium">Leave Allowance</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.leaveAllowanceMonthly)}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.leaveAllowanceAnnual)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Income Breakdown</h4>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-emerald-50"><th colSpan={4} className="text-center p-2.5 border border-slate-200 font-semibold text-emerald-700">INCOME BREAKDOWN</th></tr><tr className="bg-slate-50"><th className="text-left p-2.5 border border-slate-200 font-semibold text-slate-600">Description</th><th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Monthly (₦)</th><th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">Annual (₦)</th><th className="text-right p-2.5 border border-slate-200 font-semibold text-slate-600">%</th></tr></thead>
            <tbody>
              {Object.values(calculation.basicComponents).map((comp: any) => (<tr key={comp.code}><td className="p-2.5 border border-slate-200">{comp.name}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(comp.monthly)}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(comp.annual)}</td><td className="p-2.5 border border-slate-200 text-right">{comp.percentage.toFixed(2)}%</td></tr>))}
              {calculation.allowances.map((a: any) => {
                const pct = monthlySalary > 0 ? ((a.monthly / monthlySalary) * 100).toFixed(2) : '0.00';
                const isOverridden = allowanceOverrides[a.name] !== undefined;
                return (<tr key={a.name} className={isOverridden ? 'bg-indigo-50/30' : ''}><td className="p-2.5 border border-slate-200 flex items-center gap-1">{a.name} {isOverridden && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-1 font-semibold uppercase tracking-wider">Override</span>}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(a.monthly)}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(a.annual)}</td><td className="p-2.5 border border-slate-200 text-right">{pct}%</td></tr>);
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center"><span className="font-bold text-emerald-700">GROSS INCOME (ANNUAL)</span><span className="font-bold text-emerald-700 text-lg">{fmtMoney(calculation.grossIncomeAnnual)}</span></div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Relief & Exemption</h4>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-amber-50"><th colSpan={2} className="text-center p-2.5 border border-slate-200 font-semibold text-amber-700">RELIEF & EXEMPTION</th></tr></thead>
            <tbody>
              {calculation.statutoryDeductions.map((d: any) => {
                const isOverridden = deductionOverrides[d.name] !== undefined;
                return (<tr key={d.name} className={isOverridden ? 'bg-indigo-50/30' : ''}><td className="p-2.5 border border-slate-200 flex items-center gap-1">{d.name} {isOverridden && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-1 font-semibold uppercase tracking-wider">Override</span>}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(d.annual)}</td></tr>);
              })}
              {calculation.reliefs.map((r: any) => (<tr key={r.name}><td className="p-2.5 border border-slate-200">{r.name}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(r.amount)}</td></tr>))}
              <tr className="bg-amber-50 font-bold"><td className="p-2.5 border border-slate-200">Tax Free Pay (Total Relief)</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.totalReliefs)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">PAYE Tax Calculation</h4>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-red-50"><th colSpan={3} className="text-center p-2.5 border border-slate-200 font-semibold text-red-700">PAYE TAX CALCULATION</th></tr></thead>
            <tbody>
              <tr><td className="p-2.5 border border-slate-200">Annual Gross Income</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.grossIncomeAnnual)}</td></tr>
              <tr><td className="p-2.5 border border-slate-200">Less: Tax Free Pay</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.totalReliefs)}</td></tr>
              <tr className="bg-amber-50 font-bold"><td className="p-2.5 border border-slate-200">Taxable Income</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmtMoney(calculation.taxableIncome)}</td></tr>
              {calculation.taxBreakdown.map((b: any, idx: number) => (<tr key={idx}><td className="p-2.5 border border-slate-200">{b.description}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(b.amount)}</td><td className="p-2.5 border border-slate-200 text-center text-xs text-slate-500">{b.rate}%</td></tr>))}
              <tr className="bg-red-50 font-bold"><td className="p-2.5 border border-slate-200">Total PAYE (Annual)</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(calculation.annualTax)}</td><td className="p-2.5 border border-slate-200 text-right text-sm">{fmtMoney(calculation.monthlyTax)} / month</td></tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200"><h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Summary</h5><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Monthly Income</span><strong>{fmtMoney(calculation.grossIncomeMonthly)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Monthly PAYE Tax</span><strong>{fmtMoney(calculation.monthlyTax)}</strong></div><div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-emerald-700 font-semibold">Net Salary</span><strong className="text-emerald-700 text-base">{fmtMoney(calculation.grossIncomeMonthly - calculation.monthlyTax)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Effective Tax Rate</span><strong className="text-blue-600">{calculation.effectiveTaxRate.toFixed(2)}%</strong></div></div></div>
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200"><h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Annual Summary</h5><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Annual Gross</span><strong>{fmtMoney(calculation.grossIncomeAnnual)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Tax Free Pay</span><strong>{fmtMoney(calculation.totalReliefs)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Taxable Income</span><strong>{fmtMoney(calculation.taxableIncome)}</strong></div><div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-red-600 font-semibold">Total PAYE Tax</span><strong className="text-red-600">{fmtMoney(calculation.annualTax)}</strong></div></div></div>
        </div>
      </div>
    </div>
  );
}

// ─── Salary Calculation Engine ────────────────────────────────────────────────
interface CalculationResult { basicComponents: Record<string, any>; leaveAllowancePercentage: number; leaveAllowanceMonthly: number; leaveAllowanceAnnual: number; allowances: Array<{ name: string; monthly: number; annual: number }>; grossIncomeMonthly: number; grossIncomeAnnual: number; reliefs: Array<{ name: string; amount: number }>; totalReliefs: number; taxableIncome: number; taxBreakdown: Array<{ description: string; rate: number; amount: number }>; annualTax: number; monthlyTax: number; effectiveTaxRate: number; statutoryDeductions: Array<{ name: string; monthly: number; annual: number; percentage: number | null; basedOn: string; basedOnType: string; calcType: string; }>; totalStatutoryDeductions: number; }

function calculateSalary(monthlySalary: number, setting: SalarySetting, additionalValues: Record<string, number>, allowanceOverrides: Record<string, number> = {}, deductionOverrides: Record<string, number> = {}): CalculationResult {
  monthlySalary = Math.round(monthlySalary * 100) / 100;
  const annualSalary = Math.round(monthlySalary * 12 * 100) / 100;
  const basicComponents: Record<string, any> = {};
  let totalBasicPercentage = 0;

  if (setting.basic_components) {
    Object.values(setting.basic_components).forEach((component: any) => {
      const percentage = parseFloat(component.percentage) || 0;
      const monthlyAmount = Math.round(((monthlySalary * percentage) / 100) * 100) / 100;
      const annualAmount = Math.round(monthlyAmount * 12 * 100) / 100;
      basicComponents[component.code] = { name: component.name, code: component.code, percentage: percentage, monthly: monthlyAmount, annual: annualAmount };
      totalBasicPercentage += percentage;
    });
  }

  function calculateBaseAmount(basedOn: string, basedOnType: string): number {
    if (basedOnType === 'additional_field') return additionalValues[basedOn] || 0;
    const upper = basedOn.toUpperCase();
    if (upper === 'TOTAL') return monthlySalary;
    if (upper === 'GROSS_INCOME') return 0;
    let total = 0;
    upper.split('+').map((c) => c.trim()).forEach((code) => { if (basicComponents[code]) total += basicComponents[code].monthly; });
    return total;
  }

  let leaveAllowancePercentage = 0; let leaveAllowanceMonthly = 0; let leaveAllowanceAnnual = 0;
  if (setting.leave_allowance_percentage !== undefined) {
    leaveAllowancePercentage = parseFloat(setting.leave_allowance_percentage as any) || 0;
    const annualBasicSalary = Object.values(basicComponents).reduce((sum: number, comp: any) => sum + comp.annual, 0);
    leaveAllowanceAnnual = Math.round(((annualBasicSalary * leaveAllowancePercentage) / 100) * 100) / 100;
    leaveAllowanceMonthly = Math.round((leaveAllowanceAnnual / 12) * 100) / 100;
  }

  const allowances: Array<{ name: string; monthly: number; annual: number }> = [];
  let totalOtherAllowancesMonthly = 0; let totalOtherAllowancesAnnual = 0;
  if (setting.allowances) {
    setting.allowances.forEach((allowance: any) => {
      if (allowance.is_active !== false) {
        let monthlyAmount = 0;
        if (allowanceOverrides[allowance.name] !== undefined) {
          monthlyAmount = allowanceOverrides[allowance.name];
        } else {
          const calcType = allowance.calculation_type || 'percentage';
          const baseAmount = calculateBaseAmount(allowance.based_on || 'TOTAL', allowance.based_on_type || 'component');
          if (calcType === 'fixed') monthlyAmount = parseFloat(allowance.fixed_amount) || 0;
          else if (calcType === 'percentage') monthlyAmount = (baseAmount * (parseFloat(allowance.percentage) || 0)) / 100;
          else if (calcType === 'combined') monthlyAmount = (baseAmount * (parseFloat(allowance.percentage) || 0)) / 100 + (parseFloat(allowance.fixed_amount) || 0);
        }
        monthlyAmount = Math.round(monthlyAmount * 100) / 100;
        const annualAmount = Math.round(monthlyAmount * 12 * 100) / 100;
        allowances.push({ name: allowance.name, monthly: monthlyAmount, annual: annualAmount });
        totalOtherAllowancesMonthly += monthlyAmount; totalOtherAllowancesAnnual += annualAmount;
      }
    });
  }

  let grossIncomeMonthly: number, grossIncomeAnnual: number;
  if (setting.include_leave_in_gross) {
    grossIncomeMonthly = Math.round((monthlySalary + totalOtherAllowancesMonthly + leaveAllowanceMonthly) * 100) / 100;
    grossIncomeAnnual = Math.round((annualSalary + totalOtherAllowancesAnnual + leaveAllowanceAnnual) * 100) / 100;
  } else {
    grossIncomeMonthly = Math.round((monthlySalary + totalOtherAllowancesMonthly) * 100) / 100;
    grossIncomeAnnual = Math.round((annualSalary + totalOtherAllowancesAnnual) * 100) / 100;
  }

  const statutoryDeductions: Array<any> = [];
  let totalStatutoryDeductions = 0;
  if (setting.statutory_deductions) {
    setting.statutory_deductions.forEach((deduction: any) => {
      if (deduction.is_active !== false) {
        let amount = 0;
        if (deductionOverrides[deduction.name] !== undefined) {
          amount = deductionOverrides[deduction.name];
        } else {
          const calcType = deduction.calculation_type || 'percentage';
          const baseAmount = calculateBaseAmount(deduction.based_on || 'B', deduction.based_on_type || 'component');
          if (calcType === 'percentage') amount = (baseAmount * (parseFloat(deduction.percentage) || 0)) / 100;
          else if (calcType === 'fixed') amount = parseFloat(deduction.fixed_amount) || 0;
          else if (calcType === 'combined') amount = (baseAmount * (parseFloat(deduction.percentage) || 0)) / 100 + (parseFloat(deduction.fixed_amount) || 0);
        }
        amount = Math.round(amount * 100) / 100;
        statutoryDeductions.push({ name: deduction.name, monthly: amount, annual: Math.round(amount * 12 * 100) / 100, percentage: deductionOverrides[deduction.name] !== undefined ? null : (parseFloat(deduction.percentage) || null), basedOn: deduction.based_on || 'B', basedOnType: deduction.based_on_type || 'component', calcType: deduction.calculation_type || 'percentage' });
        totalStatutoryDeductions += amount;
      }
    });
  }

  const reliefs: Array<{ name: string; amount: number }> = [];
  let totalReliefs = 0;
  if (setting.reliefs_exemptions) {
    setting.reliefs_exemptions.forEach((relief: any) => {
      if (relief.is_active !== false) {
        const calcType = relief.calculation_type || (relief.formula_type === 'percentage_plus_fixed' ? 'combined' : relief.formula_type || 'fixed');
        let baseAmount = (relief.based_on || 'gross_income') === 'gross_income' ? grossIncomeAnnual : calculateBaseAmount(relief.based_on, relief.based_on_type || 'component') * 12;
        let amount = 0;
        if (calcType === 'percentage') amount = (baseAmount * (parseFloat(relief.percentage) || 0)) / 100;
        else if (calcType === 'fixed') amount = parseFloat(relief.fixed_amount) || 0;
        else if (calcType === 'combined') amount = (baseAmount * (parseFloat(relief.percentage) || 0)) / 100 + (parseFloat(relief.fixed_amount) || 0);
        amount = Math.round(amount * 100) / 100;
        reliefs.push({ name: relief.name, amount: amount });
        totalReliefs += amount;
      }
    });
  }

  statutoryDeductions.forEach((d) => { totalReliefs += d.annual; });
  const taxableIncome = Math.round((grossIncomeAnnual - totalReliefs) * 100) / 100;

  let annualTax = 0;
  const taxBreakdown: Array<{ description: string; rate: number; amount: number }> = [];
  if (setting.tax_brackets && setting.tax_brackets.length > 0) {
    let remainingIncome = taxableIncome;
    setting.tax_brackets.forEach((bracket: any, index: number) => {
      if (remainingIncome > 0) {
        const bracketSize = bracket.limit !== null && bracket.limit !== undefined ? parseFloat(bracket.limit) : remainingIncome;
        const taxableAmount = Math.min(remainingIncome, bracketSize);
        const taxRate = parseFloat(bracket.rate) || 0;
        const taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
        if (taxableAmount > 0) {
          let description = index === 0 ? `First ${fmtMoney(bracketSize)} @ ${taxRate}%` : bracket.limit === null || bracket.limit === undefined ? `Remaining ${fmtMoney(taxableAmount)} @ ${taxRate}%` : `Next ${fmtMoney(bracketSize)} @ ${taxRate}%`;
          taxBreakdown.push({ description, rate: taxRate, amount: taxAmount });
          annualTax += taxAmount;
          remainingIncome -= taxableAmount;
        }
      }
    });
  }

  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;
  const effectiveTaxRate = grossIncomeMonthly > 0 ? Math.round(((monthlyTax / grossIncomeMonthly) * 100) * 100) / 100 : 0;

  return { basicComponents, leaveAllowancePercentage, leaveAllowanceMonthly, leaveAllowanceAnnual, allowances, grossIncomeMonthly, grossIncomeAnnual, reliefs, totalReliefs, taxableIncome, taxBreakdown, annualTax, monthlyTax, effectiveTaxRate, statutoryDeductions, totalStatutoryDeductions };
}

// ─── Main Edit Page ────────────────────────────────────────────────────────────
interface Bank { bank_name: string; code: string; }

export default function SalaryStructureEditPage() {
  const router = useRouter();
  const params = useParams();
  const structureId = Number(params.id);
  const { user, hasPermission } = useAuth();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(true);

  // ── Data state ──
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [salarySettings, setSalarySettings] = useState<SalarySetting[]>([]);
  const [selectedSetting, setSelectedSetting] = useState<SalarySetting | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // ── Form state ──
  const [staffId, setStaffId] = useState<number | null>(null);
  const [salarySettingId, setSalarySettingId] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [additionalFieldValues, setAdditionalFieldValues] = useState<Record<string, number>>({});

  // ── Overrides state ──
  const [allowanceOverrides, setAllowanceOverrides] = useState<Record<string, number>>({});
  const [deductionOverrides, setDeductionOverrides] = useState<Record<string, number>>({});
  const [isOverridesModalOpen, setIsOverridesModalOpen] = useState(false);

  // ── Bank details state ──
  const [existingBankDetail, setExistingBankDetail] = useState<StaffBankDetail | null>(null);
  const [loadingBankDetail, setLoadingBankDetail] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [beneficiaryCode, setBeneficiaryCode] = useState('');
  const [branchSortCode, setBranchSortCode] = useState('');

  // ── UI state ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true, bank: false, additional: false, preview: true,
  });

  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');

  // ── Toast helpers ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Load banks ──
  useEffect(() => {
    (async () => {
      setLoadingBanks(true);
      try {
        const response = await fetch('https://app.nuban.com.ng/bank_codes.json');
        setBanks(await response.json());
      } catch { /* silent */ }
      finally { setLoadingBanks(false); }
    })();
  }, []);

  // ── Load staff, settings, globals, and existing structure ──
  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      setLoadingStaff(true);
      setLoadingSettings(true);
      setLoadingStructure(true);
      try {
        const [staffData, settingsData, globalDataRaw, structure] = await Promise.all([
          staffAPI.list({ page_size: 1000 }),
          salarySettingsAPI.list(),
          salaryGlobalSettingsAPI.get().catch(() => null),
          salaryStructuresAPI.get(structureId),
        ]);

        setStaffList(Array.isArray(staffData) ? staffData : (staffData as any)?.results || []);
        const settingsList = Array.isArray(settingsData) ? settingsData : (settingsData as any)?.results || [];
        setSalarySettings(settingsList);

        // Unwrap global settings
        const globalData = globalDataRaw?.data ?? globalDataRaw;
        setGlobalSettings(globalData);

        // Populate form from existing structure
        const sid = typeof structure.staff === 'object' ? (structure.staff as any).id : structure.staff;
        const ssid = typeof structure.salary_setting === 'object' ? (structure.salary_setting as any).id : structure.salary_setting;

        setStaffId(sid);
        setSalarySettingId(ssid);
        setMonthlySalary(parseFloat(structure.monthly_salary) || 0);
        setEffectiveFrom(structure.effective_from || '');
        setEffectiveTo(structure.effective_to || '');
        setIsActive(structure.is_active);
        setAdditionalFieldValues(structure.additional_field_values || {});

        // Populate overrides from database!
        setAllowanceOverrides(structure.allowance_overrides || {});
        setDeductionOverrides(structure.deduction_overrides || {});

        // Set selected setting for preview
        const setting = settingsList.find((s: SalarySetting) => s.id === ssid);
        if (setting) setSelectedSetting(setting);
      } catch (err) {
        setFormError(extractError(err));
      } finally {
        setLoadingStaff(false);
        setLoadingSettings(false);
        setLoadingStructure(false);
      }
    })();
  }, [canEdit, structureId]);

  // ── Load bank details when staffId is set ──
  useEffect(() => {
    setBankName(''); setBankCode(''); setAccountNumber(''); setAccountName(''); setBeneficiaryCode(''); setBranchSortCode(''); setExistingBankDetail(null); setBankSaved(false);

    if (!staffId) return;

    let cancelled = false;
    (async () => {
      setLoadingBankDetail(true);
      try {
        const results = await staffBankDetailsAPI.list({ staff: staffId });
        if (cancelled) return;
        const record = Array.isArray(results) ? results[0] : (results as any)?.data?.[0];
        if (record) {
          setExistingBankDetail(record);
          setBankName(record.bank_name || '');
          setBankCode(record.bank_code || '');
          setAccountNumber(record.account_number || '');
          setAccountName(record.account_name || '');
          setBeneficiaryCode(record.beneficiary_code || '');
          setBranchSortCode(record.branch_sort_code || '');
        }
      } catch (err) {
        if (!cancelled) showToast('error', 'Could not load bank details: ' + extractError(err));
      } finally {
        if (!cancelled) setLoadingBankDetail(false);
      }
    })();

    return () => { cancelled = true; };
  }, [staffId]);

  // ── Sync selected setting ──
  useEffect(() => {
    if (salarySettingId) {
      const setting = salarySettings.find((s) => s.id === salarySettingId);
      setSelectedSetting(setting || null);
    } else {
      setSelectedSetting(null);
    }
  }, [salarySettingId, salarySettings]);

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleBankChange = (name: string) => {
    setBankName(name);
    const found = banks.find((b) => b.bank_name === name);
    setBankCode(found ? found.code : '');
  };

  // ── Save Bank Details ──
  const handleSaveBankDetails = async () => {
    if (!staffId) { showToast('error', 'Select a staff member before saving bank details.'); return; }
    if (!bankName && !accountNumber && !accountName) {
      showToast('error', 'Enter at least a bank name, account number, or account name.');
      return;
    }
    setSavingBank(true);
    try {
      const payload: StaffBankDetailWrite = {
        staff: staffId, bank_name: bankName, account_name: accountName, account_number: accountNumber, bank_code: bankCode || undefined, beneficiary_code: beneficiaryCode || undefined, branch_sort_code: branchSortCode || undefined, is_active: true,
      };
      const result = existingBankDetail
        ? await staffBankDetailsAPI.update(existingBankDetail.id, payload)
        : await staffBankDetailsAPI.create(payload);
      setExistingBankDetail(result);
      setBankSaved(true);
      showToast('success', existingBankDetail ? 'Bank details updated.' : 'Bank details saved.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingBank(false);
    }
  };

  const validateForm = (): string | null => {
    if (!staffId) return 'Please select a staff member.';
    if (!salarySettingId) return 'Please select a salary setting.';
    if (!effectiveFrom) return 'Effective from date is required.';
    if (monthlySalary <= 0) return 'Monthly salary must be greater than 0.';
    return null;
  };

  const cleanCalculation = useMemo(() => {
    if (!selectedSetting) return null;
    return calculateSalary(monthlySalary, selectedSetting, additionalFieldValues, {}, {});
  }, [monthlySalary, selectedSetting, additionalFieldValues]);

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) { setFormError(validationError); return; }
    setFormError(null);
    setSubmitting(true);

    // Auto-save the bank details if they were modified but not manually saved
    if ((bankName || accountNumber || accountName) && !bankSaved) {
      try {
        const bankPayload: StaffBankDetailWrite = {
          staff: staffId!, bank_name: bankName, account_name: accountName, bank_code: bankCode || undefined, beneficiary_code: beneficiaryCode || undefined, branch_sort_code: branchSortCode || undefined, is_active: true, account_number: accountNumber,
        };
        if (existingBankDetail) await staffBankDetailsAPI.update(existingBankDetail.id, bankPayload);
        else await staffBankDetailsAPI.create(bankPayload);
      } catch (err) {
        showToast('error', 'Warning: Salary Structure will save, but Bank Details failed: ' + extractError(err));
      }
    }

    try {
      const payload: SalaryStructureWrite = {
        staff: staffId!,
        salary_setting: salarySettingId!,
        monthly_salary: monthlySalary,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_active: isActive,
        additional_field_values: additionalFieldValues,
        allowance_overrides: allowanceOverrides,
        deduction_overrides: deductionOverrides,
      };
      await salaryStructuresAPI.update(structureId, payload);
      showToast('success', 'Salary structure updated successfully.');
      router.push(`/dashboard/staff/salary/structure/${structureId}`);
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const activeOverrideCount = Object.keys(allowanceOverrides).length + Object.keys(deductionOverrides).length;

  if (!canEdit) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to edit salary structures.</p>
        </div>
      </div>
    );
  }

  if (loadingStructure) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading salary structure…</p>
        </div>
      </div>
    );
  }

  const selectedStaff = staffList.find((s) => s.id === staffId) || null;

  return (
    <div className="pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <OverridesModal
        open={isOverridesModalOpen}
        onClose={() => setIsOverridesModalOpen(false)}
        onApply={(allowances, deductions) => {
          setAllowanceOverrides(allowances);
          setDeductionOverrides(deductions);
          setIsOverridesModalOpen(false);
        }}
        setting={selectedSetting}
        cleanCalculation={cleanCalculation}
        initialAllowanceOverrides={allowanceOverrides}
        initialDeductionOverrides={deductionOverrides}
      />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push(`/dashboard/staff/salary/structure/${structureId}`)} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-200"><DollarSign className="h-5 w-5 text-white" /></div>
            Edit Salary Structure
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">{selectedStaff ? `Editing structure for ${staffLabel(selectedStaff)}` : `Structure #${structureId}`}</p>
        </div>
      </div>

      {formError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium flex-1">{formError}</p>
          <button onClick={() => setFormError(null)}><X className="h-4 w-4 text-red-400 hover:text-red-600 transition-colors" /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Section icon={<Info className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-blue-500 to-blue-700" title="Basic Information" subtitle="Staff, salary setting, and effective dates" required open={openSections.basic} onToggle={() => toggleSection('basic')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Staff <span className="text-red-500 normal-case">*</span></label>
              <StaffCombobox staffList={staffList} value={staffId} onChange={setStaffId} loading={loadingStaff} disabled />
              <p className="text-xs text-slate-400 mt-1">Staff cannot be changed on an existing structure.</p>
            </div>
            <div>
              <label className={labelCls}>Salary Setting <span className="text-red-500 normal-case">*</span></label>
              <select className={inputCls} value={salarySettingId || ''} onChange={(e) => setSalarySettingId(e.target.value ? parseInt(e.target.value) : null)} required disabled={loadingSettings}>
                <option value="">Select Salary Setting</option>
                {salarySettings.filter((s) => s.is_active || s.id === salarySettingId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} {s.is_locked ? '🔒' : ''}</option>
                ))}
              </select>
            </div>
            <div><label className={labelCls}>Effective From <span className="text-red-500 normal-case">*</span></label><input type="date" className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></div>
            <div><label className={labelCls}>Effective To</label><input type="date" className={inputCls} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /><p className="text-xs text-slate-400 mt-1">Leave empty if indefinitely valid</p></div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                Active (Auto-deactivates other structures for this staff)
              </label>
            </div>
          </div>
        </Section>

        {/* Bank Details */}
        <Accordion title="Bank Details" icon={<Landmark className="h-4 w-4 text-slate-500" />} open={openSections.bank} onToggle={() => toggleSection('bank')} badge={existingBankDetail ? <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 uppercase tracking-wide">Existing record</span> : bankSaved ? <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100 uppercase tracking-wide">Saved</span> : null}>
          {!staffId ? <p className="text-sm text-slate-400">No staff selected.</p> : loadingBankDetail ? <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading bank details…</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Bank Name</label>
                  <select className={inputCls} value={bankName} onChange={(e) => handleBankChange(e.target.value)} disabled={loadingBanks}>
                    <option value="">Select Bank</option>
                    {banks.map((bank) => (<option key={bank.code} value={bank.bank_name}>{bank.bank_name}</option>))}
                  </select>
                </div>
                <div><label className={labelCls}>Bank Code</label><input type="text" className={inputCls} value={bankCode} readOnly disabled /></div>
                <div><label className={labelCls}>Account Number</label><input type="text" className={inputCls} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. 0123456789" /></div>
                <div><label className={labelCls}>Account Name</label><input type="text" className={inputCls} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. John Doe" /></div>
                <div><label className={labelCls}>Beneficiary Code</label><input type="text" className={inputCls} value={beneficiaryCode} onChange={(e) => setBeneficiaryCode(e.target.value)} placeholder="e.g. BEN001" /></div>
                <div><label className={labelCls}>Branch Sort Code</label><input type="text" className={inputCls} value={branchSortCode} onChange={(e) => setBranchSortCode(e.target.value)} placeholder="e.g. 01-234-567" /></div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={handleSaveBankDetails} disabled={savingBank} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
                  {savingBank ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {existingBankDetail ? 'Update Bank Details' : 'Save Bank Details'}</>}
                </button>
              </div>
            </div>
          )}
        </Accordion>

        {/* Additional Fields */}
        {selectedSetting && selectedSetting.additional_fields && selectedSetting.additional_fields.length > 0 && (
          <Section icon={<Plus className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-purple-500 to-purple-700" title="Additional Salary Profile Fields" subtitle={`From "${selectedSetting.name}" — monthly values`} open={openSections.additional} onToggle={() => toggleSection('additional')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedSetting.additional_fields.map((field: any) => (
                <div key={field.code}>
                  <label className={labelCls}>{field.name}</label>
                  <input type="number" className={inputCls} step="0.01" min="0" placeholder="0.00" value={additionalFieldValues[field.code] || ''} onChange={(e) => setAdditionalFieldValues((prev) => ({ ...prev, [field.code]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Monthly Salary */}
        <Section icon={<DollarSign className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-700" title="Monthly Salary" subtitle="Update monthly salary and see recalculated breakdown" required open={openSections.preview} onToggle={() => toggleSection('preview')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Monthly Salary (₦) <span className="text-red-500 normal-case">*</span></label><input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 500000" value={monthlySalary || ''} onChange={(e) => setMonthlySalary(parseFloat(e.target.value) || 0)} required /></div>
            <div className="flex items-center"><div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700"><Info className="h-4 w-4 inline mr-1" /> All components recalculate automatically.</div></div>
          </div>

          {selectedSetting && monthlySalary > 0 ? (
            <SalaryPreview setting={selectedSetting} monthlySalary={monthlySalary} additionalValues={additionalFieldValues} allowanceOverrides={allowanceOverrides} deductionOverrides={deductionOverrides} onOpenOverrides={() => setIsOverridesModalOpen(true)} activeOverrideCount={activeOverrideCount} allowCustomOverrides={!!globalSettings?.allow_custom_overrides} />
          ) : (
            <div className="mt-4 text-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl"><DollarSign className="h-8 w-8 mx-auto text-slate-300" /><p className="mt-2 text-sm">Enter a monthly salary to see complete calculation</p></div>
          )}
        </Section>

        {/* ── Sticky Footer ── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0"><DollarSign className="h-3.5 w-3.5 text-white" /></div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{selectedStaff ? staffLabel(selectedStaff) : `Structure #${structureId}`}</p>
                <p className="text-[11px] text-slate-400 truncate">{monthlySalary > 0 ? `₦${monthlySalary.toLocaleString()} / month` : 'Enter salary'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button type="button" onClick={() => router.push(`/dashboard/staff/salary/structure/${structureId}`)} disabled={submitting} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}