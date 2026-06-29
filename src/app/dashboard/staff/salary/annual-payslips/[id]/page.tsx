'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import {
  CalendarDays, ArrowLeft, AlertCircle, Loader2, Printer,
  UserCircle, Building2, TrendingUp, TrendingDown, DollarSign,
  Shield, Percent, Gift, ChevronDown, ChevronUp, Info,
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

const now          = new Date();
const currentYear  = now.getFullYear();
const YEARS        = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).reverse();
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Print HTML Builder ───────────────────────────────────────────────────────
function buildAnnualPayslipHTML(data: AnnualData, year: number, schoolName: string): string {
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });

  const buildRows = (items: Record<string, number>) =>
    Object.entries(items).map(([name, amt]) =>
      `<tr><td style="padding:7px 12px;color:#64748b;">${name}</td><td style="padding:7px 12px;text-align:right;font-weight:600;color:#1e293b;">${fmtMoney(amt)}</td></tr>`
    ).join('');

  const totalDeductions = data.totalStatutoryDeductions + data.totalOtherDeductions + data.totalPaye + data.totalOtherTaxes;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Annual Payslip - ${data.fullName} - ${year}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 30px; max-width: 750px; margin: 0 auto; }
    .close-btn { position: fixed; top: 16px; right: 16px; background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 999; }
    .close-btn:hover { background: #dc2626; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; }
    .school-name { font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 4px; }
    .payslip-title { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 2px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .meta-item { margin-bottom: 8px; }
    .meta-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .meta-value { font-size: 13px; color: #1e293b; font-weight: 500; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    td { padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    .subtotal-row td { background: #f8fafc; font-weight: 700; color: #1e293b; padding: 9px 12px; }
    .total-row td { background: #eff6ff; font-weight: 700; color: #4f46e5; padding: 10px 12px; font-size: 13px; }
    .net-pay-box { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .net-label { font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .net-sub { font-size: 12px; opacity: 0.7; margin-bottom: 8px; }
    .net-amount { font-size: 32px; font-weight: 800; }
    .footer { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { .close-btn { display: none; } body { padding: 15px; } @page { margin: 15mm; size: A4 portrait; } }
  </style>
</head>
<body>
  <button class="close-btn" onclick="window.close()">✕ Close</button>

  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="payslip-title">Annual Payroll Summary</div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-item"><div class="meta-label">Name</div><div class="meta-value">${data.fullName}</div></div>
      <div class="meta-item"><div class="meta-label">Staff ID</div><div class="meta-value">${data.staffId || 'N/A'}</div></div>
      <div class="meta-item"><div class="meta-label">Department</div><div class="meta-value">${data.department}</div></div>
    </div>
    <div style="text-align:right;">
      <div class="meta-item"><div class="meta-label">Year</div><div class="meta-value">${year}</div></div>
      <div class="meta-item"><div class="meta-label">Months Covered</div><div class="meta-value">${data.monthsCount} month${data.monthsCount !== 1 ? 's' : ''}</div></div>
      <div class="meta-item"><div class="meta-label">Periods</div><div class="meta-value">${data.monthsCovered.join(', ')}</div></div>
    </div>
  </div>

  <!-- Income -->
  <table>
    <thead><tr><th>Income Component</th><th style="text-align:right">Amount (₦)</th></tr></thead>
    <tbody>
      ${Object.keys(data.basicComponents).length > 0 ? `
        <tr><td colspan="2" class="section-title">Basic Components</td></tr>
        ${buildRows(data.basicComponents)}
      ` : ''}
      ${Object.keys(data.allowances).length > 0 ? `
        <tr><td colspan="2" class="section-title">Allowances</td></tr>
        ${buildRows(data.allowances)}
      ` : ''}
      ${data.totalBonus > 0 ? `
        <tr><td colspan="2" class="section-title">Bonus</td></tr>
        <tr><td style="padding:7px 12px;color:#64748b;">Total Bonus</td><td style="padding:7px 12px;text-align:right;font-weight:600;color:#1e293b;">${fmtMoney(data.totalBonus)}</td></tr>
      ` : ''}
      ${Object.keys(data.additionalIncome).length > 0 ? `
        <tr><td colspan="2" class="section-title">Additional Income</td></tr>
        ${buildRows(data.additionalIncome)}
      ` : ''}
    </tbody>
    <tfoot>
      <tr class="total-row"><td>Total Gross Income (A)</td><td style="text-align:right;">${fmtMoney(data.totalGrossIncome)}</td></tr>
    </tfoot>
  </table>

  <!-- Deductions -->
  <table>
    <thead><tr><th>Deductions</th><th style="text-align:right">Amount (₦)</th></tr></thead>
    <tbody>
      ${Object.keys(data.statutoryDeductions).length > 0 ? `
        <tr><td colspan="2" class="section-title">Statutory Deductions (B)</td></tr>
        ${buildRows(data.statutoryDeductions)}
        <tr class="subtotal-row"><td>Sub-Total Statutory (B)</td><td style="text-align:right;">${fmtMoney(data.totalStatutoryDeductions)}</td></tr>
      ` : ''}
      ${Object.keys(data.otherDeductions).length > 0 ? `
        <tr><td colspan="2" class="section-title">Other Deductions (C)</td></tr>
        ${buildRows(data.otherDeductions)}
        <tr class="subtotal-row"><td>Sub-Total Other (C)</td><td style="text-align:right;">${fmtMoney(data.totalOtherDeductions)}</td></tr>
      ` : ''}
      <tr><td colspan="2" class="section-title">Taxation (D)</td></tr>
      <tr><td style="padding:7px 12px;color:#64748b;">Total PAYE Tax</td><td style="padding:7px 12px;text-align:right;font-weight:600;color:#1e293b;">${fmtMoney(data.totalPaye)}</td></tr>
      ${data.totalOtherTaxes > 0 ? `<tr><td style="padding:7px 12px;color:#64748b;">Other Taxes</td><td style="padding:7px 12px;text-align:right;font-weight:600;color:#1e293b;">${fmtMoney(data.totalOtherTaxes)}</td></tr>` : ''}
      <tr class="subtotal-row"><td>Sub-Total Tax (D)</td><td style="text-align:right;">${fmtMoney(data.totalPaye + data.totalOtherTaxes)}</td></tr>
    </tbody>
    <tfoot>
      <tr class="total-row"><td>Total Deductions (B + C + D)</td><td style="text-align:right;">${fmtMoney(totalDeductions)}</td></tr>
    </tfoot>
  </table>

  <!-- Net Pay -->
  <div class="net-pay-box">
    <div class="net-label">Total Annual Net Salary (A − B − C − D)</div>
    <div class="net-sub">${data.monthsCovered.join(', ')} · ${year}</div>
    <div class="net-amount">${fmtMoney(data.totalNetSalary)}</div>
  </div>

  <div class="footer">
    <p><strong>Generated:</strong> ${now}</p>
    <p style="margin-top:4px">This is a computer-generated annual payroll summary.</p>
    <p style="margin-top:4px">${schoolName}</p>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

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

  const fetchData = useCallback(async () => {
    if (!structureId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all records for this structure for the selected year
      // Use salary_structure filter if available, otherwise filter client-side
      const res = await payrollAPI.listRecords({
        year,
        page_size: 1000,
      }) as any;

      const allRecords = unwrapList(res);

      // Filter to only this structure's records
      const records = allRecords.filter((r: any) => {
        const sid = typeof r.salary_structure === 'object' ? r.salary_structure?.id : r.salary_structure;
        return sid === structureId;
      });

      if (records.length === 0) {
        setError(`No payroll records found for this staff in ${year}.`);
        setLoading(false);
        return;
      }

      // Aggregate
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

        // Basic components
        Object.entries(r.basic_components_breakdown || {}).forEach(([, comp]: [string, any]) => {
          const name   = comp?.name || '';
          const amount = parseFloat(comp?.amount) || 0;
          if (name && amount > 0) data.basicComponents[name] = (data.basicComponents[name] || 0) + amount;
        });

        // Allowances
        Object.entries(r.allowances_breakdown || {}).forEach(([name, allow]: [string, any]) => {
          const amount = parseFloat(allow?.amount ?? allow) || 0;
          if (amount > 0) data.allowances[name] = (data.allowances[name] || 0) + amount;
        });

        // Additional income
        Object.entries(r.additional_income || {}).forEach(([name, val]: [string, any]) => {
          const amount = parseFloat(val) || 0;
          if (amount > 0) data.additionalIncome[name] = (data.additionalIncome[name] || 0) + amount;
        });

        // Statutory deductions
        Object.entries(r.statutory_deductions || {}).forEach(([name, ded]: [string, any]) => {
          const amount = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
          if (amount > 0) {
            data.statutoryDeductions[name] = (data.statutoryDeductions[name] || 0) + amount;
            data.totalStatutoryDeductions += amount;
          }
        });

        // Other deductions
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

  // Update URL when year changes
  const handleYearChange = (y: number) => {
    setYear(y);
    router.replace(`/dashboard/staff/salary/annual-payslips/${structureId}?year=${y}`);
  };

  if (!canView) return <div className="p-10 text-center text-slate-500">Access Denied</div>;

  const totalDeductions = annualData
    ? annualData.totalStatutoryDeductions + annualData.totalOtherDeductions + annualData.totalPaye + annualData.totalOtherTaxes
    : 0;

  return (
    <div className="space-y-5 pb-10" id="printable-report">

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
            <button onClick={() => {
              const html = buildAnnualPayslipHTML(annualData, year, schoolInfo?.name || 'School');
              const win = window.open('', '_blank');
              if (win) { win.document.write(html); win.document.close(); }
            }}
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

    </div>
  );
}