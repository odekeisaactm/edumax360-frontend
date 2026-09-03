'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import { SalaryRecord } from '@/lib/salary_management.types';
import {
  FileText, CalendarDays, AlertCircle, Loader2, Printer,
  UserCircle, Building2, TrendingUp, TrendingDown, DollarSign,
  Shield, Percent, Gift, ChevronDown, ChevronUp, Info, X, Calendar,
  Wallet, MinusCircle
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unwrapList(res: any): any[] {
  const data = res?.results?.data ?? res?.data?.results ?? res?.data ?? res?.results ?? res;
  return Array.isArray(data) ? data : [];
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

function getImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).reverse();
const MONTHS = [
  { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
  { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
  { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
  { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' }
];

interface AnnualData {
  staffId: string;
  fullName: string;
  department: string;
  monthsCovered: string[];
  monthsCount: number;
  basicComponents: Record<string, number>;
  allowances: Record<string, number>;
  additionalIncome: Record<string, number>;
  totalBonus: number;
  totalGrossIncome: number;
  statutoryDeductions: Record<string, number>;
  otherDeductions: Record<string, number>;
  totalStatutoryDeductions: number;
  totalOtherDeductions: number;
  totalPaye: number;
  totalOtherTaxes: number;
  totalNetSalary: number;
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Section({ title, icon, iconBg, total, totalColor = 'text-slate-800', children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>{icon}</div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {total !== undefined && <span className={`text-sm font-bold ${totalColor}`}>{fmtMoney(total)}</span>}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function Row({ label, value, isTotal, sub }: any) {
  return (
    <div className={`flex justify-between items-center py-2.5 px-3 rounded-lg text-sm ${isTotal ? 'bg-slate-50 border border-slate-100 font-bold mt-2' : 'border-b border-slate-50 last:border-0'}`}>
      <div>
        <span className={isTotal ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <span className={isTotal ? 'text-slate-800' : 'font-medium text-slate-700'}>{value}</span>
    </div>
  );
}

function SubSection({ title, items }: { title: string; items: Record<string, number> }) {
  if (Object.keys(items).length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-0.5">
        {Object.entries(items).map(([name, amt]) => <Row key={name} label={name} value={fmtMoney(amt)} />)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyPayslipsPage() {
  const { schoolInfo } = useAuth();

  const [mode, setMode]   = useState<'monthly' | 'annual'>('monthly');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear]   = useState(currentYear);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Data
  const [monthlyRecord, setMonthlyRecord] = useState<SalaryRecord | null>(null);
  const [annualData, setAnnualData]       = useState<AnnualData | null>(null);

  // Modals
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Print Escape Key Listener
  useEffect(() => {
    if (!showPrintPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPrintPreview(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintPreview]);

  // Fetch Logic
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'monthly') {
        const res = await payrollAPI.myRecords({ month, year, page_size: 1 }) as any;
        const records = unwrapList(res);
        setMonthlyRecord(records.length > 0 ? records[0] : null);
      } else {
        const res = await payrollAPI.myRecords({ year, page_size: 1000 }) as any;
        const records = unwrapList(res);

        if (records.length === 0) {
          setAnnualData(null);
          setLoading(false);
          return;
        }

        const data: AnnualData = {
          staffId: '', fullName: '', department: '',
          monthsCovered: [], monthsCount: 0,
          basicComponents: {}, allowances: {}, additionalIncome: {},
          totalBonus: 0, totalGrossIncome: 0,
          statutoryDeductions: {}, otherDeductions: {},
          totalStatutoryDeductions: 0, totalOtherDeductions: 0,
          totalPaye: 0, totalOtherTaxes: 0, totalNetSalary: 0,
        };

        records.forEach((r: any) => {
          const staffDetail = r.staff_detail || {};
          data.staffId    = staffDetail.staff_id   || '';
          data.fullName   = staffDetail.full_name  || r.staff_name || 'Unknown';
          data.department = staffDetail.department_name || 'N/A';

          data.monthsCovered.push(MONTHS.find(m => m.val === r.month)?.name || String(r.month));
          data.monthsCount  += 1;
          data.totalBonus   += parseFloat(r.bonus)       || 0;
          data.totalGrossIncome += parseFloat(r.gross_salary) || 0;
          data.totalPaye    += parseFloat(r.monthly_tax) || 0;
          data.totalOtherTaxes += parseFloat(r.other_taxes) || 0;
          data.totalNetSalary  += parseFloat(r.net_salary)  || 0;

          Object.entries(r.basic_components_breakdown || {}).forEach(([, comp]: [string, any]) => {
            const name = comp?.name || ''; const amt = parseFloat(comp?.amount) || 0;
            if (name && amt > 0) data.basicComponents[name] = (data.basicComponents[name] || 0) + amt;
          });
          Object.entries(r.allowances_breakdown || {}).forEach(([name, allow]: [string, any]) => {
            const amt = parseFloat(allow?.amount ?? allow) || 0;
            if (amt > 0) data.allowances[name] = (data.allowances[name] || 0) + amt;
          });
          Object.entries(r.additional_income || {}).forEach(([name, val]: [string, any]) => {
            const amt = parseFloat(val) || 0;
            if (amt > 0) data.additionalIncome[name] = (data.additionalIncome[name] || 0) + amt;
          });
          Object.entries(r.statutory_deductions || {}).forEach(([name, ded]: [string, any]) => {
            const amt = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
            if (amt > 0) { data.statutoryDeductions[name] = (data.statutoryDeductions[name] || 0) + amt; data.totalStatutoryDeductions += amt; }
          });
          Object.entries(r.other_deductions || {}).forEach(([name, ded]: [string, any]) => {
            const amt = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
            if (amt > 0) { data.otherDeductions[name] = (data.otherDeductions[name] || 0) + amt; data.totalOtherDeductions += amt; }
          });
        });
        setAnnualData(data);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [mode, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived Variables for Monthly View
  const staff = (monthlyRecord?.staff_detail as any) || {};
  const monthName = monthlyRecord?.month_name || MONTHS.find(m => m.val === month)?.name;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partially_paid: { label: 'Partially Paid', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Pending', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    not_processed: { label: 'Not Processed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const currentStatus = monthlyRecord ? (statusConfig[monthlyRecord.payment_status] || statusConfig.not_processed) : statusConfig.not_processed;
  const allowancesBreakdown = (monthlyRecord as any)?.allowances_breakdown || {};
  const hasAllowances = Object.keys(allowancesBreakdown).some(k => parseFloat(allowancesBreakdown[k]?.amount) > 0);

  // Derived Variables for Annual View
  const totalDeductions = annualData ? annualData.totalStatutoryDeductions + annualData.totalOtherDeductions + annualData.totalPaye + annualData.totalOtherTaxes : 0;

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">

      {/* Print CSS constraints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}} />

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            My Payslips
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View and print your payroll history</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button onClick={() => setMode('monthly')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'monthly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
            <button onClick={() => setMode('annual')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'annual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Annual Summary</button>
          </div>

          {/* Filters */}
          {mode === 'monthly' && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-700">
              {MONTHS.map(m => <option key={m.val} value={m.val}>{m.name}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-700">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {((mode === 'monthly' && monthlyRecord) || (mode === 'annual' && annualData)) && (
            <button onClick={() => setShowPrintPreview(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all">
              <Printer className="h-4 w-4" /> Print
            </button>
          )}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="min-h-[400px] bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-sm font-medium text-slate-400">Loading your records...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      )}

      {/* MONTHLY VIEW */}
      {!loading && !error && mode === 'monthly' && !monthlyRecord && (
        <div className="min-h-[400px] bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center p-10 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Payslip Found</h3>
          <p className="text-sm text-slate-500">There is no payroll record generated for you in {MONTHS.find(m => m.val === month)?.name} {year}.</p>
        </div>
      )}

      {!loading && !error && mode === 'monthly' && monthlyRecord && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-indigo-100 bg-indigo-50/30 flex items-center gap-3">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-indigo-900">PAYSLIP</h2>
              <span className={`ml-auto inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full border ${currentStatus.cls}`}>
                {currentStatus.label}
              </span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3"><UserCircle className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Name</p><p className="font-bold text-slate-800">{staff.full_name || 'N/A'}</p></div></div>
                <div className="flex items-start gap-3"><Info className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Staff ID</p><p className="font-mono font-bold text-slate-700">{staff.staff_id || 'N/A'}</p></div></div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3"><Calendar className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Period</p><p className="font-bold text-slate-700">{monthName} {monthlyRecord.year}</p></div></div>
                <div className="flex items-start gap-3"><Wallet className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Payment Date</p><p className="font-bold text-slate-700">{monthlyRecord.paid_date ? new Date(monthlyRecord.paid_date).toLocaleDateString() : 'Pending'}</p></div></div>
              </div>
            </div>
          </div>

          <Section title="Income & Allowances" icon={<Wallet className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-emerald-500 to-green-600" total={monthlyRecord.total_income} totalColor="text-emerald-700">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-slate-100"><th className="py-2 pr-4">Component</th><th className="py-2 pr-4">%</th><th className="py-2 text-right">Amount (₦)</th></tr></thead>
              <tbody>
                {Object.entries(monthlyRecord.basic_components_breakdown || {}).map(([code, comp]: [string, any]) => (
                  <tr key={code} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{comp.name}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{comp.percentage}%</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{fmtMoney(comp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasAllowances && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Allowances</p>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(allowancesBreakdown).map(([name, allow]: [string, any]) => (
                      parseFloat(allow.amount) > 0 ? <Row key={name} label={name} value={fmtMoney(allow.amount)} /> : null
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(parseFloat(monthlyRecord.bonus as string) > 0 || Object.keys(monthlyRecord.additional_income || {}).length > 0) && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Additional Income</p>
                <table className="w-full text-sm">
                  <tbody>
                    {parseFloat(monthlyRecord.bonus as string) > 0 && <Row label="Bonus" value={fmtMoney(monthlyRecord.bonus)} />}
                    {Object.entries(monthlyRecord.additional_income || {}).map(([name, amount]: [string, any]) => (
                      parseFloat(amount as string) > 0 ? <Row key={name} label={name} value={fmtMoney(amount as string)} /> : null
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Row label="Total Payable (A)" value={fmtMoney(monthlyRecord.total_income)} isTotal />
          </Section>

          <Section title="Deductions" icon={<MinusCircle className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-rose-500 to-red-600" total={parseFloat(monthlyRecord.total_statutory_deductions as string) + parseFloat(monthlyRecord.total_other_deductions as string) + parseFloat(monthlyRecord.total_taxation as string)} totalColor="text-rose-600">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Statutory (B)</p>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(monthlyRecord.statutory_deductions || {}).map(([name, ded]: [string, any]) => {
                    const amt = typeof ded === 'object' ? ded?.amount : ded;
                    return parseFloat(amt) > 0 ? (
                      <tr key={name} className="border-b border-slate-50 last:border-0"><td className="py-2.5 pr-4 text-slate-500">{name} {ded?.percentage ? `(${ded.percentage}% of ${ded.based_on})` : ''}</td><td className="py-2.5 text-right font-medium text-slate-700">{fmtMoney(amt)}</td></tr>
                    ) : null;
                  })}
                  <Row label="Sub-Total Statutory (B)" value={fmtMoney(monthlyRecord.total_statutory_deductions)} isTotal />
                </tbody>
              </table>
            </div>

            {Object.keys(monthlyRecord.other_deductions || {}).length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Other Deductions (C)</p>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(monthlyRecord.other_deductions || {}).map(([name, ded]: [string, any]) => {
                      const amt = typeof ded === 'object' ? ded?.amount : ded;
                      return parseFloat(amt) > 0 ? <Row key={name} label={name} value={fmtMoney(amt)} /> : null;
                    })}
                    <Row label="Sub-Total Other (C)" value={fmtMoney(monthlyRecord.total_other_deductions)} isTotal />
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Taxation (D)</p>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="PAYE Tax" value={fmtMoney(monthlyRecord.monthly_tax)} />
                  {parseFloat(monthlyRecord.other_taxes as string) > 0 && <Row label="Other Taxes" value={fmtMoney(monthlyRecord.other_taxes)} />}
                  <Row label="Sub-Total Tax (D)" value={fmtMoney(monthlyRecord.total_taxation)} isTotal />
                </tbody>
              </table>
            </div>
          </Section>

          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl shadow-lg p-8 text-center text-white">
            <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest mb-1">Take Home Pay</p>
            <p className="text-indigo-200 text-xs font-semibold mb-4">Gross Income (A) − Total Deductions (B)</p>
            <h2 className="text-5xl font-black tracking-tight">{fmtMoney(monthlyRecord.net_salary)}</h2>
          </div>
        </>
      )}

      {/* ANNUAL VIEW */}
      {!loading && !error && mode === 'annual' && !annualData && (
        <div className="min-h-[400px] bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center p-10 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Annual Records Found</h3>
          <p className="text-sm text-slate-500">There are no payroll records processed for you in the year {year}.</p>
        </div>
      )}

      {!loading && !error && mode === 'annual' && annualData && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center"><UserCircle className="h-5 w-5 text-indigo-500" /></div>
              <h3 className="text-sm font-bold text-slate-800">Staff Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Name</p><p className="font-semibold text-slate-800">{annualData.fullName}</p></div>
              <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Staff ID</p><p className="font-mono font-bold text-slate-700">{annualData.staffId || 'N/A'}</p></div>
              <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Department</p><p className="font-medium text-slate-700">{annualData.department}</p></div>
              <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Period</p><p className="font-medium text-slate-700">{annualData.monthsCount} month{annualData.monthsCount !== 1 ? 's' : ''} · {year}</p><p className="text-[11px] text-slate-400 mt-0.5">{annualData.monthsCovered.join(', ')}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Gross Income', value: fmtMoney(annualData.totalGrossIncome), color: 'from-blue-500 to-blue-600',     Icon: TrendingUp },
              { label: 'Total Deductions',   value: fmtMoney(totalDeductions),              color: 'from-red-500 to-rose-600',      Icon: TrendingDown },
              { label: 'Total Net Pay',      value: fmtMoney(annualData.totalNetSalary),    color: 'from-emerald-500 to-green-600', Icon: DollarSign },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}><Icon className="h-4 w-4 text-white" /></div>
                <div className="min-w-0"><p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">{label}</p><p className="text-base font-black text-slate-800 tabular-nums truncate">{value}</p></div>
              </div>
            ))}
          </div>

          <Section title="Total Income" icon={<TrendingUp className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-blue-500 to-blue-700" total={annualData.totalGrossIncome}>
            <SubSection title="Basic Components" items={annualData.basicComponents} />
            <SubSection title="Allowances" items={annualData.allowances} />
            {annualData.totalBonus > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Bonus</p>
                <Row label="Total Bonus" value={fmtMoney(annualData.totalBonus)} />
              </div>
            )}
            <SubSection title="Additional Income" items={annualData.additionalIncome} />
            <Row label="Total Gross Income (A)" value={fmtMoney(annualData.totalGrossIncome)} isTotal />
          </Section>

          <Section title="Total Deductions" icon={<TrendingDown className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-red-500 to-rose-600" total={totalDeductions} totalColor="text-red-600">
            {Object.keys(annualData.statutoryDeductions).length > 0 && (
              <><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Statutory Deductions</p>
              <div className="space-y-0.5">{Object.entries(annualData.statutoryDeductions).map(([name, amt]) => <Row key={name} label={name} value={fmtMoney(amt)} />)}</div></>
            )}
            <SubSection title="Other Deductions" items={annualData.otherDeductions} />
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Taxation</p>
              <div className="space-y-0.5">
                <Row label="Total PAYE Tax" value={fmtMoney(annualData.totalPaye)} />
                {annualData.totalOtherTaxes > 0 && <Row label="Other Taxes" value={fmtMoney(annualData.totalOtherTaxes)} />}
              </div>
            </div>
            <Row label="Total Deductions (B + C + D)" value={fmtMoney(totalDeductions)} isTotal />
          </Section>

          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-2xl shadow-lg p-8 text-center text-white">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Total Annual Net Salary</p>
            <p className="text-indigo-300 text-xs font-semibold mb-4">{annualData.monthsCount} month{annualData.monthsCount !== 1 ? 's' : ''} · {annualData.monthsCovered.join(', ')} · {year}</p>
            <h2 className="text-5xl font-black tracking-tight">{fmtMoney(annualData.totalNetSalary)}</h2>
          </div>
        </>
      )}

      {/* ── IN-DOM PRINT OVERLAY (Handles BOTH Monthly and Annual logic dynamically) ── */}
      {showPrintPreview && (
        <div onClick={() => setShowPrintPreview(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* Action bar — hidden on print */}
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintPreview(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            <div className="p-8 print:p-6 text-slate-900">
              {/* Letterhead */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-7 w-7 text-slate-400" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{schoolInfo?.address || 'Address not configured'}</p>
                  <p className="text-[11px] font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                  {mode === 'monthly' ? 'Payslip' : 'Annual Payslip'}
                </span>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Name</span><span className="font-bold text-slate-900">{mode === 'monthly' ? staff.full_name : annualData?.fullName}</span></div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Staff ID</span><span className="font-bold text-slate-900">{mode === 'monthly' ? staff.staff_id : annualData?.staffId}</span></div>
                  <div><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Department</span><span className="font-bold text-slate-900">{mode === 'monthly' ? staff.department_name : annualData?.department}</span></div>
                </div>
                <div className="text-right">
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">{mode === 'monthly' ? 'Period' : 'Year'}</span><span className="font-bold text-slate-900">{mode === 'monthly' ? `${monthName} ${year}` : year}</span></div>
                  {mode === 'monthly' ? (
                    <>
                      <div className="mb-2"><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Payment Date</span><span className="font-bold text-slate-900">{monthlyRecord?.paid_date ? new Date(monthlyRecord.paid_date).toLocaleDateString() : 'Pending'}</span></div>
                      <div className="mt-2"><span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentStatus.cls}`}>{currentStatus.label}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="mb-2"><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Months Covered</span><span className="font-bold text-slate-900">{annualData?.monthsCount} month{annualData?.monthsCount !== 1 ? 's' : ''}</span></div>
                      <div><span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Periods</span><span className="text-[11px] font-bold text-slate-600">{annualData?.monthsCovered.join(', ')}</span></div>
                    </>
                  )}
                </div>
              </div>

              {/* Earnings Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-black text-slate-600 uppercase tracking-wide">Income Component</th>
                      <th className="px-4 py-2.5 text-right text-xs font-black text-slate-600 uppercase tracking-wide">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mode === 'monthly' ? (
                      <>
                        {Object.entries(monthlyRecord?.basic_components_breakdown || {}).map(([code, comp]: [string, any]) => (
                          <tr key={code} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{comp.name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(comp.amount)}</td></tr>
                        ))}
                        {Object.entries(allowancesBreakdown).map(([name, allow]: [string, any]) => (
                          parseFloat(allow.amount) > 0 ? <tr key={name} className="bg-emerald-50/30"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name} (Allowance)</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(allow.amount)}</td></tr> : null
                        ))}
                        {parseFloat(monthlyRecord?.bonus as string) > 0 && <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-bold">Bonus</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(monthlyRecord?.bonus)}</td></tr>}
                        {Object.entries(monthlyRecord?.additional_income || {}).map(([name, amount]: [string, any]) => (
                          parseFloat(amount as string) > 0 ? <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amount as string)}</td></tr> : null
                        ))}
                      </>
                    ) : (
                      <>
                        {Object.entries(annualData?.basicComponents || {}).map(([name, amt]) => <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr>)}
                        {Object.entries(annualData?.allowances || {}).map(([name, amt]) => <tr key={name} className="bg-emerald-50/30"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr>)}
                        {annualData && annualData.totalBonus > 0 && <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-bold">Total Bonus</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(annualData.totalBonus)}</td></tr>}
                        {Object.entries(annualData?.additionalIncome || {}).map(([name, amt]) => <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr>)}
                      </>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/50 border-t-2 border-indigo-200">
                      <td className="px-4 py-3 text-indigo-800 font-black">Gross Income (A)</td>
                      <td className="px-4 py-3 text-right text-indigo-800 font-black text-base">{fmtMoney(mode === 'monthly' ? monthlyRecord?.total_income : annualData?.totalGrossIncome)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deductions Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-black text-slate-600 uppercase tracking-wide">Deductions</th>
                      <th className="px-4 py-2.5 text-right text-xs font-black text-slate-600 uppercase tracking-wide">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mode === 'monthly' ? (
                      <>
                        {Object.entries(monthlyRecord?.statutory_deductions || {}).map(([name, ded]: [string, any]) => {
                          const amt = typeof ded === 'object' ? ded?.amount : ded;
                          return parseFloat(amt) > 0 ? <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr> : null;
                        })}
                        {Object.entries(monthlyRecord?.other_deductions || {}).map(([name, ded]: [string, any]) => {
                          const amt = typeof ded === 'object' ? ded?.amount : ded;
                          return parseFloat(amt) > 0 ? <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr> : null;
                        })}
                        {parseFloat(monthlyRecord?.monthly_tax as string) > 0 && <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">PAYE Tax</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(monthlyRecord?.monthly_tax)}</td></tr>}
                        {parseFloat(monthlyRecord?.other_taxes as string) > 0 && <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">Other Taxes</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(monthlyRecord?.other_taxes)}</td></tr>}
                      </>
                    ) : (
                      <>
                        {Object.entries(annualData?.statutoryDeductions || {}).map(([name, amt]) => <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr>)}
                        {Object.entries(annualData?.otherDeductions || {}).map(([name, amt]) => <tr key={name} className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">{name}</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(amt)}</td></tr>)}
                        <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">Total PAYE Tax</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(annualData?.totalPaye)}</td></tr>
                        {annualData && annualData.totalOtherTaxes > 0 && <tr className="bg-white"><td className="px-4 py-2.5 text-slate-600 font-semibold">Other Taxes</td><td className="px-4 py-2.5 text-slate-900 font-bold text-right">{fmtMoney(annualData.totalOtherTaxes)}</td></tr>}
                      </>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/50 border-t-2 border-rose-200">
                      <td className="px-4 py-3 text-rose-800 font-black">Total Deductions (B)</td>
                      <td className="px-4 py-3 text-right text-rose-800 font-black text-base">
                        {fmtMoney(mode === 'monthly' ? (parseFloat(monthlyRecord?.total_statutory_deductions as string) + parseFloat(monthlyRecord?.total_other_deductions as string) + parseFloat(monthlyRecord?.total_taxation as string)) : totalDeductions)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Net Pay Box */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl p-6 text-center mb-8 shadow-md border border-indigo-500">
                <p className="text-[11px] uppercase font-black tracking-widest text-indigo-100 mb-1.5">Net Salary (A − B)</p>
                <p className="text-4xl font-extrabold">{fmtMoney(mode === 'monthly' ? monthlyRecord?.net_salary : annualData?.totalNetSalary)}</p>
              </div>

              <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-6 border-t border-slate-200 pt-6">
                This is a computer-generated payslip.<br/>
                <span className="mt-1 block text-slate-500">Generated: {now.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}