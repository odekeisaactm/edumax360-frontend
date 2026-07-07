'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { Expense } from '@/lib/finance.types';

interface Props {
  schoolName?: string;
  filterSummary?: string;
  getExportRows: () => Promise<Expense[]>;
  baseCurrency?: string;
}

function fmtMoney(amount: string | number, symbol = '₦'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  return symbol + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function buildPrintHTML(rows: Expense[], title: string, schoolName?: string, filterSummary?: string, baseCurrency = '₦'): string {
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });
  const headers = ['#', 'Voucher #', 'Category', 'In Favour Of', 'Source Account', 'Method', 'Amount', 'Date'];

  const bodyRows = rows.map((r, i) => {
    const cells = [
      i + 1,
      `<strong style="font-family:monospace">${r.voucher_number || r.reference || `EXP-${r.id}`}</strong>`,
      r.category_name || 'General Expense',
      r.name || r.description || '—',
      r.bank_account_name || 'Physical Cash Vault',
      `<span style="text-transform:capitalize">${r.payment_method || 'transfer'}</span>`,
      `<strong>${fmtMoney(r.amount, baseCurrency)}</strong>`,
      formatDate(r.expense_date),
    ];
    return `<tr class="${i % 2 === 0 ? 'even' : ''}">${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  }).join('');

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; padding: 20mm 15mm; }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #dc2626; padding-bottom: 14px; }
    .header .school { font-size: 13px; font-weight: 700; color: #dc2626; margin-bottom: 4px; }
    .header h1 { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .header .meta { font-size: 9.5px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #dc2626; color: #fff; padding: 7px 8px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr.even td { background: #f8fafc; }
    .totals { margin-top: 14px; text-align: right; font-size: 11px; }
    .totals strong { color: #dc2626; font-size: 13px; }
    @media print { @page { margin: 10mm; size: A4 landscape; } }
  </style>
</head>
<body>
  <div class="header">
    ${schoolName ? `<div class="school">${schoolName}</div>` : ''}
    <h1>${title}</h1>
    <div class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${rows.length}</div>
  </div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="totals">Total Expenditure Recorded: <strong>${fmtMoney(totalAmount, baseCurrency)}</strong></div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

export default function ExpenseExporter({ schoolName, filterSummary, getExportRows, baseCurrency = '₦' }: Props) {
  const [open, setOpen]           = useState(false);
  const [title, setTitle]         = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const resolvedTitle = title.trim() || `Master Expenditure Ledger – ${new Date().toLocaleDateString('en-NG')}`;

  const handleExcel = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      const XLSX = await import('xlsx');

      const sheetRows = rows.map((r) => ({
        'Voucher #':        r.voucher_number || r.reference || `EXP-${r.id}`,
        'Category':         r.category_name || 'General Expense',
        'In Favour Of':     r.name || '—',
        'Source Account':   r.bank_account_name || 'Physical Cash Vault',
        'Payment Method':   r.payment_method || 'transfer',
        'Amount Recorded':  parseFloat(String(r.amount)) || 0,
        'Expense Date':     formatDate(r.expense_date),
        'Vote & Subhead':   r.vote_and_subhead || '—',
        'Description':      r.description || '—',
        'Prepared By':      r.prepared_by_name || '—',
        'Authorised By':    r.authorised_by_name || '—',
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenditure Ledger');
      XLSX.writeFile(wb, `expenditure_ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('success', 'Excel ledger downloaded successfully.');
      setOpen(false);
    } catch (e: any) {
      showToast('error', e?.message || 'Excel export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      const html = buildPrintHTML(rows, resolvedTitle, schoolName, filterSummary, baseCurrency);
      const win  = window.open('', '_blank');
      if (!win) { showToast('error', 'Pop-up blocked. Allow pop-ups to export PDF.'); return; }
      win.document.write(html);
      win.document.close();
      showToast('success', 'Print dialog opened.');
      setOpen(false);
    } catch (e: any) {
      showToast('error', e?.message || 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      <button onClick={() => { setTitle(''); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
        <Download className="h-4 w-4" /> Export Ledger
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Download className="h-5 w-5 text-red-600" /> Export Expenditure Ledger
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Report Title <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={resolvedTitle}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3 justify-end pt-2 border-t border-slate-100">
                <button onClick={() => setOpen(false)} disabled={exporting} className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleExcel} disabled={exporting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
                </button>
                <button onClick={handlePDF} disabled={exporting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}