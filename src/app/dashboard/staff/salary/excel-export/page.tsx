'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, payrollAPI } from '@/lib/salary_management.service';
import {
  FileSpreadsheet, Search, X, RefreshCw, AlertCircle, Loader2,
  Download, Filter, Building2, Landmark,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(amount: string | number | undefined | null): string {
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
const currentMonth = now.getMonth() + 1;
const currentYear  = now.getFullYear();

interface PaymentRow {
  staff_ref: string;
  beneficiary_name: string;
  account_name: string;
  amount: number;
  payment_due_date: string;
  beneficiary_code: string;
  beneficiary_account_number: string;
  branch_sort_code: string;
  debit_account: string;
  bank_name: string;
  department: string;
  staff_id: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BankPaymentExportPage() {
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_salaryrecord');

  const [month, setMonth]           = useState(currentMonth);
  const [year, setYear]             = useState(currentYear);
  const [search, setSearch]         = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [sortBy, setSortBy]         = useState<'name' | 'bank' | 'department'>('name');
  const [dueDate, setDueDate]       = useState(now.toISOString().split('T')[0]);
  const [debitAccount, setDebitAccount] = useState('');

  const [loading, setLoading]     = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rawData, setRawData]     = useState<PaymentRow[]>([]);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [structsRes, recordsRes] = await Promise.all([
        salaryStructuresAPI.list({ is_active: true, page_size: 1000 }),
        payrollAPI.listRecords({ month, year, page_size: 1000 }),
      ]) as any[];

      const structs: any[] = unwrapList(structsRes);
      const records: any[] = unwrapList(recordsRes);

      // Map staffId → payroll record
      const recordMap: Record<number, any> = {};
      records.forEach(r => {
        const sid = typeof r.staff === 'object' ? r.staff?.id : r.staff;
        if (sid) recordMap[sid] = r;
      });

      const rows: PaymentRow[] = [];

      structs.forEach(struct => {
        const bd = struct.bank_detail;
        if (!bd?.bank_name || !bd?.account_number) return; // skip no bank details

        const staffDetail = struct.staff_detail || {};
        const staffId     = struct.staff;
        const record      = recordMap[staffId];
        if (!record) return; // skip staff with no payroll record this period

        const staffIdStr    = staffDetail.staff_id || String(staffId);
        const staffIdPadded = staffIdStr.padStart(3, '0');
        const staffRef      = `${year}${String(month).padStart(2, '0')}${staffIdPadded}`;

        rows.push({
          staff_ref:                   staffRef,
          beneficiary_name:            staffDetail.full_name || struct.staff_name || 'N/A',
          account_name:                bd.account_name || '',
          amount:                      parseFloat(record.net_salary) || 0,
          payment_due_date:            dueDate,
          beneficiary_code:            bd.beneficiary_code || '',
          beneficiary_account_number:  bd.account_number,
          branch_sort_code:            bd.branch_sort_code || '',
          debit_account:               debitAccount,
          bank_name:                   bd.bank_name,
          department:                  staffDetail.department_name || 'N/A',
          staff_id:                    staffIdStr,
        });
      });

      setRawData(rows);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [month, year, dueDate, debitAccount]);

  useEffect(() => { if (canView) fetchData(); }, [fetchData, canView]);

  // ── Filter + Sort (client-side) ──
  const filteredData = useMemo(() => {
    let data = [...rawData];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.beneficiary_name.toLowerCase().includes(q) ||
        r.staff_id.toLowerCase().includes(q)
      );
    }

    if (bankFilter) {
      data = data.filter(r => r.bank_name === bankFilter);
    }

    if (sortBy === 'name') {
      data.sort((a, b) => a.beneficiary_name.localeCompare(b.beneficiary_name));
    } else if (sortBy === 'bank') {
      data.sort((a, b) => a.bank_name.localeCompare(b.bank_name) || a.beneficiary_name.localeCompare(b.beneficiary_name));
    } else if (sortBy === 'department') {
      data.sort((a, b) => a.department.localeCompare(b.department) || a.beneficiary_name.localeCompare(b.beneficiary_name));
    }

    return data;
  }, [rawData, search, bankFilter, sortBy]);

  const totalAmount = useMemo(() => filteredData.reduce((s, r) => s + r.amount, 0), [filteredData]);
  const uniqueBanks = useMemo(() => Array.from(new Set(rawData.map(r => r.bank_name))).sort(), [rawData]);

  // ── Excel Export ──
  const handleDownloadExcel = () => {
    const exportData = filteredData.map(r => ({
      'staff ref':                   r.staff_ref,
      'beneficiary name':            r.beneficiary_name,
      'Amount':                      r.amount,
      'payment due date':            dueDate,
      'beneficiary code':            r.beneficiary_code,
      'beneficiary account number':  r.beneficiary_account_number,
      'branch sort code':            r.branch_sort_code,
      'debit account':               debitAccount,
    }));

    const ws   = XLSX.utils.json_to_sheet(exportData);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Payment');

    // Column widths
    ws['!cols'] = [
      { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 18 },
      { wch: 18 }, { wch: 26 }, { wch: 18 }, { wch: 18 },
    ];

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    XLSX.writeFile(wb, `bank_payment_${monthName}_${year}.xlsx`);
  };

  if (!canView) return <div className="p-10 text-center text-slate-500">Access Denied</div>;

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            Bank Payment Export
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">{monthName} {year}</p>
        </div>
        <button
          onClick={handleDownloadExcel}
          disabled={filteredData.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Staff</p>
            <p className="text-2xl font-bold text-slate-800">{filteredData.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Amount</p>
            <p className="text-2xl font-bold text-slate-800">{fmtMoney(totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h5 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" /> Filters & Settings
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              {Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Search Staff</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Name or ID…"
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Filter by Bank</label>
            <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="name">Name</option>
              <option value="bank">Bank</option>
              <option value="department">Department</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Debit Account</label>
            <input type="text" value={debitAccount} onChange={e => setDebitAccount(e.target.value)}
              placeholder="Enter debit account"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="flex items-end">
            <button onClick={fetchData}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all">
              <RefreshCw className="h-4 w-4" /> Apply
            </button>
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <span className="text-sm text-slate-400">Loading payment data…</span>
          </div>
        ) : pageError ? (
          <div className="p-16 text-center">
            <AlertCircle className="h-7 w-7 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Staff Ref</th>
                  <th className="px-4 py-3">Beneficiary Name</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment Due Date</th>
                  <th className="px-4 py-3">Beneficiary Code</th>
                  <th className="px-4 py-3">Account Number</th>
                  <th className="px-4 py-3">Branch Sort Code</th>
                  <th className="px-4 py-3">Debit Account</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">
                      No payment data found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.staff_ref}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>{row.beneficiary_name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />{row.department}
                          {row.bank_name && <><span className="text-slate-300">·</span>{row.bank_name}</>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtMoney(row.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{dueDate || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.beneficiary_code || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{row.beneficiary_account_number}</td>
                      <td className="px-4 py-3 text-slate-500">{row.branch_sort_code || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{debitAccount || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                    <td className="px-4 py-3" colSpan={2}>TOTAL ({filteredData.length} staff)</td>
                    <td className="px-4 py-3 text-right text-indigo-700">{fmtMoney(totalAmount)}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}