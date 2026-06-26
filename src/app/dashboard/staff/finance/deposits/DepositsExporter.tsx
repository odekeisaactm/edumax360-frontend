'use client';

// ─── DepositsExporter ──────────────────────────────────────────────────────────
// PDF: opens a print-styled page in a new tab (zero jspdf/canvg dependency).
// Excel: uses xlsx which is pure JS and SSR-safe when dynamically imported.
// This file is loaded via: dynamic(() => import('./DepositsExporter'), { ssr: false })

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface ExportRow {
  id: number | string;
  personName: string;
  personId: string;
  walletType?: string;
  amount: string | number;
  method: string;
  status: string;
  created: string;
  reference?: string;
  tellerNumber?: string;
}

interface Props {
  viewType: 'student' | 'staff';
  schoolName?: string;
  filterSummary?: string;
  getExportRows: () => Promise<ExportRow[]>;
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Print PDF via new tab ─────────────────────────────────────────────────────
function buildPrintHTML(
  rows: ExportRow[],
  viewType: 'student' | 'staff',
  title: string,
  schoolName?: string,
  filterSummary?: string,
): string {
  const isStudent = viewType === 'student';
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });

  const headers = isStudent
    ? ['#', 'Student', 'Reg No.', 'Wallet', 'Amount', 'Method', 'Status', 'Date']
    : ['#', 'Staff', 'Staff ID', 'Amount', 'Method', 'Status', 'Date'];

  const statusColors: Record<string, string> = {
    confirmed: '#059669',
    pending:   '#d97706',
    declined:  '#dc2626',
    failed:    '#dc2626',
    reverted:  '#64748b',
  };

  const bodyRows = rows.map((r, i) => {
    const color = statusColors[r.status] ?? '#64748b';
    const cells = isStudent
      ? [
          i + 1,
          `<strong>${r.personName}</strong>`,
          r.personId || '—',
          r.walletType || '—',
          `<strong>${fmtMoney(r.amount)}</strong>`,
          r.method,
          `<span style="color:${color};font-weight:600">${r.status}</span>`,
          r.created,
        ]
      : [
          i + 1,
          `<strong>${r.personName}</strong>`,
          r.personId || '—',
          `<strong>${fmtMoney(r.amount)}</strong>`,
          r.method,
          `<span style="color:${color};font-weight:600">${r.status}</span>`,
          r.created,
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
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: #fff;
      padding: 20mm 15mm;
    }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #059669; padding-bottom: 14px; }
    .header .school { font-size: 13px; font-weight: 700; color: #059669; margin-bottom: 4px; }
    .header h1 { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .header .meta { font-size: 9.5px; color: #64748b; }
    .filters { font-size: 9.5px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0;
               border-radius: 4px; padding: 5px 10px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #059669; color: #fff; padding: 7px 8px; text-align: left;
         font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr.even td { background: #f8fffe; }
    .totals { margin-top: 14px; text-align: right; font-size: 11px; }
    .totals strong { color: #059669; font-size: 13px; }
    .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8;
              border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print {
      body { padding: 10mm; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${schoolName ? `<div class="school">${schoolName}</div>` : ''}
    <h1>${title}</h1>
    <div class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${rows.length}</div>
  </div>
  ${filterSummary ? `<div class="filters">Filters applied: ${filterSummary}</div>` : ''}
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="totals">
    Total Amount: <strong>${fmtMoney(totalAmount)}</strong>
  </div>
  <div class="footer">
    ${schoolName ? `${schoolName} &mdash; ` : ''}${title} &mdash; Printed ${now}
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function DepositsExporter({ viewType, schoolName, filterSummary, getExportRows }: Props) {
  const [open, setOpen]         = useState(false);
  const [title, setTitle]       = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const resolvedTitle = title.trim()
    || `${viewType === 'student' ? 'Student' : 'Staff'} Deposits – ${new Date().toLocaleDateString('en-NG')}`;

  // ─── Excel ──
  const handleExcel = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      // xlsx is pure JS — safe to dynamic-import
      const XLSX = await import('xlsx');

      const sheetRows = rows.map((r) => {
        const base: Record<string, any> = {
          'ID':          r.id,
          'Name':        r.personName,
          'ID Number':   r.personId || '—',
          'Amount (₦)':  parseFloat(String(r.amount)) || 0,
          'Method':      r.method,
          'Status':      r.status,
          'Date':        r.created,
          'Reference':   r.reference  || '—',
          'Teller #':    r.tellerNumber || '—',
        };
        if (viewType === 'student') base['Wallet Type'] = r.walletType || '—';
        return base;
      });

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Deposits');
      XLSX.writeFile(wb, `${viewType}_deposits_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('success', 'Excel file downloaded.');
      setOpen(false);
    } catch (e: any) {
      showToast('error', e?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  // ─── PDF via print window ──
  const handlePDF = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      const html = buildPrintHTML(rows, viewType, resolvedTitle, schoolName, filterSummary);
      const win  = window.open('', '_blank');
      if (!win) {
        showToast('error', 'Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
      }
      win.document.write(html);
      win.document.close();
      showToast('success', 'Print dialog opened — choose "Save as PDF".');
      setOpen(false);
    } catch (e: any) {
      showToast('error', e?.message || 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => { setTitle(''); setOpen(true); }}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
      >
        <Download className="h-4 w-4" /> Export
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                Export Deposits
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Report Title <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={resolvedTitle}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <p className="text-xs text-slate-400">
                PDF opens a print-preview tab — select <strong>Save as PDF</strong> in your browser's print dialog.
              </p>

              <div className="flex items-center gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setOpen(false)}
                  disabled={exporting}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExcel}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Excel
                </button>
                <button
                  onClick={handlePDF}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}