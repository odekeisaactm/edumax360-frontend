'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import {
  CalendarDays, Search, X, RefreshCw, AlertCircle, Loader2,
  Eye, FileText, Building2, UserCircle, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, DollarSign,
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

const now = new Date();
const currentYear = now.getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).reverse();
const MONTH_ABBRS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface StaffAnnualRow {
  structureId: number;
  staffId: string;
  fullName: string;
  department: string;
  monthsCovered: string[];
  monthsCount: number;
  totalIncome: number;
  totalDeductions: number;
  totalNet: number;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnnualPayslipsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_salaryrecord');

  const [year, setYear]       = useState(currentYear);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [rows, setRows]       = useState<StaffAnnualRow[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch all records for selected year ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollAPI.listRecords({ year, page_size: 1000 }) as any;
      const records = unwrapList(res);

      // Group by staff
      const map = new Map<number, StaffAnnualRow>();

      records.forEach((r: any) => {
        const staffDetail = r.staff_detail || {};
        const staffPk     = typeof r.staff === 'object' ? r.staff?.id : r.staff;
        const structureId = typeof r.salary_structure === 'object' ? r.salary_structure?.id : r.salary_structure;

        if (!map.has(staffPk)) {
          map.set(staffPk, {
            structureId,
            staffId:       staffDetail.staff_id || String(staffPk),
            fullName:      staffDetail.full_name || r.staff_name || 'Unknown',
            department:    staffDetail.department_name || 'N/A',
            monthsCovered: [],
            monthsCount:   0,
            totalIncome:   0,
            totalDeductions: 0,
            totalNet:      0,
          });
        }

        const row = map.get(staffPk)!;
        row.monthsCovered.push(MONTH_ABBRS[(r.month || 1) - 1]);
        row.monthsCount   += 1;
        row.totalIncome   += parseFloat(r.gross_salary)              || 0;
        row.totalDeductions += (
          (parseFloat(r.total_statutory_deductions) || 0) +
          (parseFloat(r.total_other_deductions)     || 0) +
          (parseFloat(r.monthly_tax)                || 0)
        );
        row.totalNet      += parseFloat(r.net_salary) || 0;
      });

      setRows(Array.from(map.values()));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { if (canView) fetchData(); }, [fetchData, canView]);

  // ── Search filter ──
  const filtered = React.useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.fullName.toLowerCase().includes(q) ||
      r.staffId.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ── Stats ──
  const totalNet    = filtered.reduce((s, r) => s + r.totalNet, 0);
  const totalIncome = filtered.reduce((s, r) => s + r.totalIncome, 0);

  if (!canView) return <div className="p-10 text-center text-slate-500">Access Denied</div>;

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            Annual Payroll Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Full year payroll summary per staff — {year}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Staff',    value: String(filtered.length),  color: 'from-blue-500 to-blue-600',     Icon: FileText },
          { label: 'Total Income',   value: fmtMoney(totalIncome),    color: 'from-violet-500 to-purple-600', Icon: TrendingUp },
          { label: 'Total Net Pay',  value: fmtMoney(totalNet),       color: 'from-emerald-500 to-green-600', Icon: DollarSign },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-base font-bold text-slate-800 tabular-nums truncate">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name, ID or department…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={fetchData} title="Refresh"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            <span className="text-sm text-slate-400">Loading annual payroll…</span>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <AlertCircle className="h-7 w-7 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="h-7 w-7 text-indigo-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {search ? 'No staff match your search' : `No payroll records for ${year}`}
            </h3>
            <p className="text-sm text-slate-400">
              {search ? 'Try a different search term.' : 'Process payroll for this year first.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_150px_130px_130px_130px_100px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Months</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Gross Income</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Deductions</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Net Pay</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Action</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map((row) => (
                <div key={row.structureId}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_150px_130px_130px_130px_100px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Staff — avatar inline */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{row.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono">{row.staffId}</span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{row.department}</span>
                      </div>
                    </div>
                  </div>

                  {/* Months */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[11px] font-semibold">
                      {row.monthsCount} month{row.monthsCount !== 1 ? 's' : ''}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{row.monthsCovered.join(', ')}</p>
                  </div>

                  {/* Gross */}
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-700">{fmtMoney(row.totalIncome)}</span>
                  </div>

                  {/* Deductions */}
                  <div className="text-right">
                    <span className="text-sm font-semibold text-red-500">{fmtMoney(row.totalDeductions)}</span>
                  </div>

                  {/* Net */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-700">{fmtMoney(row.totalNet)}</span>
                  </div>

                  {/* Action */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => router.push(`/dashboard/staff/salary/annual-payslips/${row.structureId}?year=${year}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-600">{filtered.length}</span> staff ·{' '}
                <span className="font-semibold text-slate-600">{year}</span>
                {search && <span className="ml-1 text-blue-500">(filtered)</span>}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}