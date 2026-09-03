'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import {
  CalendarDays, ArrowLeft, AlertCircle, Loader2, Printer,
  UserCircle, Building2, TrendingUp, TrendingDown, DollarSign,
  Shield, Percent, Gift, ChevronDown, ChevronUp, Info, X
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

const now          = new Date();
const currentYear  = now.getFullYear();
const YEARS        = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).reverse();
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface AnnualData {
  staffId: string;
  fullName: string;
  department: string;
  structureId: number;
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

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({ title, icon, iconBg, total, totalColor = 'text-slate-800', children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; iconBg: string;
  total?: number; totalColor?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>
            {icon}
          </div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {total !== undefined && (
            <span className={`text-sm font-bold ${totalColor}`}>{fmtMoney(total)}</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function Row({ label, value, isTotal, sub }: { label: string; value: string; isTotal?: boolean; sub?: string }) {
  return (
    <div className={`flex justify-between items-center py-2.5 px-3 rounded-lg text-sm
      ${isTotal ? 'bg-slate-50 border border-slate-100 font-bold mt-2' : 'border-b border-slate-50 last:border-0'}`}>
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
        {Object.entries(items).map(([name, amt]) => (
          <Row key={name} label={name} value={fmtMoney(amt)} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnnualPayslipDetailPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const { user, hasPermission, schoolInfo } = useAuth();

  const structureId = Number(params?.id);
  const [year, setYear] = useState(Number(searchParams.get('year')) || currentYear);

  const canView = user?.is_superuser || hasPermission('finance.view_salaryrecord');

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [annualData, setAnnualData] = useState<AnnualData | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Close print preview on Escape
  useEffect(() => {
    if (!showPrintPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPrintPreview(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintPreview]);

  const fetchData = useCallback(async () => {
    if (!structureId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await payrollAPI.listRecords({ year, page_size: 1000 }) as any;
      const allRecords = unwrapList(res);

      const records = allRecords.filter((r: any) => {
        const sid = typeof r.salary_structure === 'object' ? r.salary_structure?.id : r.salary_structure;
        return sid === structureId;
      });

      if (records.length === 0) {
        setError(`No payroll records found for this staff in ${year}.`);
        setLoading(false);
        return;
      }

      const data: AnnualData = {
        staffId:                  '',
        fullName:                 '',
        department:               '',
        structureId,
        monthsCovered:            [],
        monthsCount:              0,
        basicComponents:          {},
        allowances:               {},
        additionalIncome:         {},
        totalBonus:               0,
        totalGrossIncome:         0,
        statutoryDeductions:      {},
        otherDeductions:          {},
        totalStatutoryDeductions: 0,
        totalOtherDeductions:     0,
        totalPaye:                0,
        totalOtherTaxes:          0,
        totalNetSalary:           0,
      };

      records.forEach((r: any) => {
        const staffDetail = r.staff_detail || {};
        data.staffId    = staffDetail.staff_id   || '';
        data.fullName   = staffDetail.full_name  || r.staff_name || 'Unknown';
        data.department = staffDetail.department_name || 'N/A';

        data.monthsCovered.push(MONTH_NAMES[(r.month || 1) - 1]);
        data.monthsCount  += 1;
        data.totalBonus   += parseFloat(r.bonus)       || 0;
        data.totalGrossIncome += parseFloat(r.gross_salary) || 0;
        data.totalPaye    += parseFloat(r.monthly_tax) || 0;
        data.totalOtherTaxes += parseFloat(r.other_taxes) || 0;
        data.totalNetSalary  += parseFloat(r.net_salary)  || 0;

        Object.entries(r.basic_components_breakdown || {}).forEach(([, comp]: [string, any]) => {
          const name   = comp?.name || '';
          const amount = parseFloat(comp?.amount) || 0;
          if (name && amount > 0) data.basicComponents[name] = (data.basicComponents[name] || 0) + amount;
        });

        Object.entries(r.allowances_breakdown || {}).forEach(([name, allow]: [string, any]) => {
          const amount = parseFloat(allow?.amount ?? allow) || 0;
          if (amount > 0) data.allowances[name] = (data.allowances[name] || 0) + amount;
        });

        Object.entries(r.additional_income || {}).forEach(([name, val]: [string, any]) => {
          const amount = parseFloat(val) || 0;
          if (amount > 0) data.additionalIncome[name] = (data.additionalIncome[name] || 0) + amount;
        });

        Object.entries(r.statutory_deductions || {}).forEach(([name, ded]: [string, any]) => {
          const amount = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
          if (amount > 0) {
            data.statutoryDeductions[name] = (data.statutoryDeductions[name] || 0) + amount;
            data.totalStatutoryDeductions += amount;
          }
        });

        Object.entries(r.other_deductions || {}).forEach(([name, ded]: [string, any]) => {
          const amount = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
          if (amount > 0) {
            data.otherDeductions[name] = (data.otherDeductions[name] || 0) + amount;
            data.totalOtherDeductions += amount;
          }
        });
      });

      setAnnualData(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [structureId, year]);

  useEffect(() => { if (canView) fetchData(); }, [fetchData, canView]);

  const handleYearChange = (y: number) => {
    setYear(y);
    router.replace(`/dashboard/staff/salary/annual-payslips/${structureId}?year=${y}`);
  };

  if (!canView) return <div className="p-10 text-center text-slate-500">Access Denied</div>;

  const totalDeductions = annualData
    ? annualData.totalStatutoryDeductions + annualData.totalOtherDeductions + annualData.totalPaye + annualData.totalOtherTaxes
    : 0;

  return (
    <div className="space-y-5 pb-10">

      {/* Print CSS constraints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {annualData ? annualData.fullName : 'Annual Payroll'}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Annual Payroll Report · {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => handleYearChange(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {annualData && (
            <button onClick={() => setShowPrintPreview(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
              <Printer className="h-4 w-4" /> Print
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <span className="text-sm text-slate-400">Loading annual payroll…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      {!loading && annualData && (
        <>
          {/* Staff info card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-indigo-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Staff Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-1">Name</p>
                <p className="font-semibold text-slate-800">{annualData.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Staff ID</p>
                <p className="font-mono font-medium text-slate-700">{annualData.staffId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Department</p>
                <p className="font-medium text-slate-700 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />{annualData.department}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Period</p>
                <p className="font-medium text-slate-700 flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  {annualData.monthsCount} month{annualData.monthsCount !== 1 ? 's' : ''} · {year}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{annualData.monthsCovered.join(', ')}</p>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Gross Income', value: fmtMoney(annualData.totalGrossIncome), color: 'from-blue-500 to-blue-600',     Icon: TrendingUp },
              { label: 'Total Deductions',   value: fmtMoney(totalDeductions),              color: 'from-red-500 to-rose-600',      Icon: TrendingDown },
              { label: 'Total Net Pay',      value: fmtMoney(annualData.totalNetSalary),    color: 'from-emerald-500 to-green-600', Icon: DollarSign },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">{label}</p>
                  <p className="text-base font-bold text-slate-800 tabular-nums truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Income */}
          <Section
            title="Total Income"
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
            total={annualData.totalGrossIncome}
          >
            <Row label="Total Gross Income" value={fmtMoney(annualData.totalGrossIncome)} isTotal />
            <SubSection title="Basic Components" items={annualData.basicComponents} />
            <SubSection title="Allowances" items={annualData.allowances} />
            {annualData.totalBonus > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" /> Bonus
                </p>
                <Row label="Total Bonus" value={fmtMoney(annualData.totalBonus)} />
              </div>
            )}
            <SubSection title="Additional Income" items={annualData.additionalIncome} />
          </Section>

          {/* Deductions */}
          <Section
            title="Total Deductions"
            icon={<TrendingDown className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-red-500 to-rose-600"
            total={totalDeductions}
            totalColor="text-red-600"
          >
            {Object.keys(annualData.statutoryDeductions).length > 0 && (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Statutory Deductions
                </p>
                <div className="space-y-0.5">
                  {Object.entries(annualData.statutoryDeductions).map(([name, amt]) => (
                    <Row key={name} label={name} value={fmtMoney(amt)} />
                  ))}
                  <Row label="Sub-Total Statutory" value={fmtMoney(annualData.totalStatutoryDeductions)} isTotal />
                </div>
              </>
            )}

            <SubSection title="Other Deductions" items={annualData.otherDeductions} />
            {annualData.totalOtherDeductions > 0 && (
              <Row label="Sub-Total Other" value={fmtMoney(annualData.totalOtherDeductions)} isTotal />
            )}

            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Taxation
              </p>
              <div className="space-y-0.5">
                <Row label="Total PAYE Tax" value={fmtMoney(annualData.totalPaye)} />
                {annualData.totalOtherTaxes > 0 && <Row label="Other Taxes" value={fmtMoney(annualData.totalOtherTaxes)} />}
                <Row label="Sub-Total Tax" value={fmtMoney(annualData.totalPaye + annualData.totalOtherTaxes)} isTotal />
              </div>
            </div>
          </Section>

          {/* Grand total */}
          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-2xl shadow-lg p-8 text-center text-white">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">Total Annual Net Salary</p>
            <p className="text-indigo-300 text-sm mb-4">
              {annualData.monthsCount} month{annualData.monthsCount !== 1 ? 's' : ''} · {annualData.monthsCovered.join(', ')} · {year}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight">{fmtMoney(annualData.totalNetSalary)}</h2>
          </div>
        </>
      )}

      {/* ── PRINTABLE OVERLAY (In-DOM approach) ── */}
      {showPrintPreview && annualData && (
        <div onClick={() => setShowPrintPreview(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* Action bar — hidden on print */}
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintPreview(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            <div className="p-8 print:p-6 text-slate-900">

              {/* Letterhead */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{schoolInfo?.address || 'Address not configured'}</p>
                  <p className="text-[11px] font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                  Annual Payslip
                </span>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Name</span><span className="font-medium text-slate-900">{annualData.fullName}</span></div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Staff ID</span><span className="font-medium text-slate-900">{annualData.staffId || 'N/A'}</span></div>
                  <div><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Department</span><span className="font-medium text-slate-900">{annualData.department}</span></div>
                </div>
                <div className="text-right">
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Year</span><span className="font-medium text-slate-900">{year}</span></div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Months Covered</span><span className="font-medium text-slate-900">{annualData.monthsCount} month{annualData.monthsCount !== 1 ? 's' : ''}</span></div>
                  <div><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Periods</span><span className="text-[11px] font-medium text-slate-600">{annualData.monthsCovered.join(', ')}</span></div>
                </div>
              </div>

              {/* Earnings Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Income Component</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 uppercase">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Basic Components */}
                    {Object.keys(annualData.basicComponents).length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Basic Components</td>
                      </tr>
                    )}
                    {Object.entries(annualData.basicComponents).map(([name, amt]) => (
                      <tr key={name} className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">{name}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                      </tr>
                    ))}

                    {/* Allowances */}
                    {Object.keys(annualData.allowances).length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Allowances</td>
                      </tr>
                    )}
                    {Object.entries(annualData.allowances).map(([name, amt]) => (
                      <tr key={name} className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">{name}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                      </tr>
                    ))}

                    {/* Bonus */}
                    {annualData.totalBonus > 0 && (
                      <tr className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600 font-bold">Total Bonus</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(annualData.totalBonus)}</td>
                      </tr>
                    )}

                    {/* Additional Income */}
                    {Object.keys(annualData.additionalIncome).length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Additional Income</td>
                      </tr>
                    )}
                    {Object.entries(annualData.additionalIncome).map(([name, amt]) => (
                      <tr key={name} className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">{name}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                      <td className="px-4 py-3 text-indigo-700 font-bold">Total Gross Income (A)</td>
                      <td className="px-4 py-3 text-right text-indigo-700 font-bold text-base">{fmtMoney(annualData.totalGrossIncome)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deductions Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Deductions</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 uppercase">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">

                    {/* Statutory Block */}
                    {Object.keys(annualData.statutoryDeductions).length > 0 && (
                      <>
                        <tr className="bg-slate-50">
                          <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Statutory Deductions (B)</td>
                        </tr>
                        {Object.entries(annualData.statutoryDeductions).map(([name, amt]) => (
                          <tr key={name} className="bg-white">
                            <td className="px-4 py-2.5 text-slate-600">{name}</td>
                            <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <td className="px-4 py-2.5 font-bold text-slate-700">Sub-Total Statutory (B)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmtMoney(annualData.totalStatutoryDeductions)}</td>
                        </tr>
                      </>
                    )}

                    {/* Other Deductions Block */}
                    {Object.keys(annualData.otherDeductions).length > 0 && (
                      <>
                        <tr className="bg-slate-50">
                          <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Other Deductions (C)</td>
                        </tr>
                        {Object.entries(annualData.otherDeductions).map(([name, amt]) => (
                          <tr key={name} className="bg-white">
                            <td className="px-4 py-2.5 text-slate-600">{name}</td>
                            <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <td className="px-4 py-2.5 font-bold text-slate-700">Sub-Total Other (C)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmtMoney(annualData.totalOtherDeductions)}</td>
                        </tr>
                      </>
                    )}

                    {/* Tax Block */}
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Taxation (D)</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600">Total PAYE Tax</td>
                      <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(annualData.totalPaye)}</td>
                    </tr>
                    {annualData.totalOtherTaxes > 0 && (
                      <tr className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">Other Taxes</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(annualData.totalOtherTaxes)}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <td className="px-4 py-2.5 font-bold text-slate-700">Sub-Total Tax (D)</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmtMoney(annualData.totalPaye + annualData.totalOtherTaxes)}</td>
                    </tr>

                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/50 border-t-2 border-rose-100">
                      <td className="px-4 py-3 text-rose-700 font-bold">Total Deductions (B + C + D)</td>
                      <td className="px-4 py-3 text-right text-rose-700 font-bold text-base">{fmtMoney(totalDeductions)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Net Pay Box */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl p-6 text-center mb-8 shadow-md">
                <p className="text-[11px] uppercase font-semibold tracking-widest text-indigo-100 mb-1.5">Total Annual Net Salary (A − B − C − D)</p>
                <p className="text-[12px] opacity-80 mb-4">{annualData.monthsCovered.join(', ')} · {year}</p>
                <p className="text-4xl font-extrabold">{fmtMoney(annualData.totalNetSalary)}</p>
              </div>

              {/* Footer text */}
              <p className="text-center text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-6 border-t border-slate-200 pt-6">
                This is a computer-generated annual payroll summary. Contact Human Resources for any discrepancies.<br/>
                <span className="mt-1 block font-bold text-slate-500">Generated: {now.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}