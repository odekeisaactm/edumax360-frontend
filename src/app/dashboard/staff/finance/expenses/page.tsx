'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  expenseAPI,
  expenseCategoriesAPI,
  academicCalendarAPI,
  financeSettingsAPI,
} from '@/lib/api';
import type { Expense, ExpenseCategory } from '@/lib/finance.types';
import {
  ArrowDownRight, Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, Check, FileText, DollarSign, Plus, ExternalLink,
  FilterX, Trash2, Landmark, Wallet, Edit3, Printer, Lock, AlertTriangle,
} from 'lucide-react';
import ExpenseExporter from './ExpenseExporter';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data || err?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);

    if (Array.isArray(d.non_field_errors) && d.non_field_errors.length > 0) {
      return String(d.non_field_errors[0]);
    }

    // Extract exact DRF field validation errors (e.g. "Amount: This field is required.")
    if (typeof d === 'object') {
      const messages: string[] = [];
      for (const [key, val] of Object.entries(d)) {
        if (Array.isArray(val) && val.length > 0) {
          const fieldLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
          messages.push(`${fieldLabel}: ${val[0]}`);
        } else if (typeof val === 'string') {
          messages.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`);
        }
      }
      if (messages.length > 0) return messages.join(' | ');
    }
  }
  return err?.message || 'An unexpected error occurred.';
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

const PAGE_SIZE = 20;

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Dual Print Engine 1: Official Payment Voucher (Matching print_voucher.html) ──
function triggerPrintVoucher(item: Expense, schoolName?: string, baseCurrency = '₦') {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print payment vouchers.'); return; }

  let lineItemsHtml = '';
  try {
    const items = typeof item.line_items_json === 'string' ? JSON.parse(item.line_items_json) : item.line_items_json;
    if (Array.isArray(items) && items.length > 0) {
      lineItemsHtml = items.map((li: any) => `
        <tr>
          <td style="border:1px solid #000;padding:8px;width:120px;">${li.date || ''}</td>
          <td style="border:1px solid #000;padding:8px;">${li.particular || ''}</td>
          <td style="border:1px solid #000;padding:8px;text-align:right;width:150px;">${fmtMoney(li.amount || 0, baseCurrency)}</td>
        </tr>`).join('');
    }
  } catch {}

  if (!lineItemsHtml) {
    lineItemsHtml = `
      <tr>
        <td style="border:1px solid #000;padding:8px;width:120px;">${formatDate(item.expense_date)}</td>
        <td style="border:1px solid #000;padding:8px;">${item.category_name || 'Expenditure'} ${item.description ? `- ${item.description}` : ''}</td>
        <td style="border:1px solid #000;padding:8px;text-align:right;width:150px;">${fmtMoney(item.amount, baseCurrency)}</td>
      </tr>
      <tr><td style="border:1px solid #000;padding:12px;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td></tr>
      <tr><td style="border:1px solid #000;padding:12px;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td></tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Voucher - ${item.voucher_number || item.reference || item.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; padding: 20px; }
    .voucher-container { max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 15px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .header h1 { font-size: 20px; color: #dc2626; margin-bottom: 5px; }
    .voucher-title { background: #dc2626; color: white; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; margin-bottom: 10px; }
    .voucher-number { text-align: right; font-size: 11px; margin-bottom: 10px; }
    .in-favour { border: 1px solid #000; padding: 8px; margin-bottom: 15px; }
    .in-favour-label { font-size: 10px; font-style: italic; margin-bottom: 3px; }
    .in-favour-value { font-weight: bold; font-size: 13px; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .table th { background: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: center; }
    .total-row { font-weight: bold; background: #f9f9f9; }
    .signature-section { margin-top: 20px; font-size: 11px; }
    .two-column { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .signature-line label { display: inline-block; width: 150px; font-weight: bold; }
    .signature-line .line { display: inline-block; border-bottom: 1px solid #000; width: 220px; font-weight: 600; padding-bottom: 2px; }
    .cheque-section { border: 2px solid #000; padding: 10px; margin: 15px 0; }
    .no-print { text-align: center; margin-bottom: 20px; }
    @media print { .no-print { display: none; } .voucher-container { border: none; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 10px 24px; font-size: 14px; font-weight:bold; cursor: pointer; background: #dc2626; color: white; border: none; border-radius: 6px;">🖨️ Print Payment Voucher</button>
    <button onclick="window.close()" style="padding: 10px 24px; font-size: 14px; cursor: pointer; background: #64748b; color: white; border: none; border-radius: 6px; margin-left: 8px;">Close Window</button>
  </div>
  <div class="voucher-container">
    <div class="header">
      <h1>${schoolName || 'INSTITUTIONAL MANAGEMENT SYSTEM'}</h1>
      <p>OFFICIAL EXPENDITURE VOUCHER</p>
    </div>
    <div class="voucher-title">PAYMENT VOUCHER</div>
    <div class="voucher-number"><strong>Voucher No:</strong> ${item.voucher_number || item.reference || `EXP-${item.id}`}</div>
    <div class="in-favour">
      <div class="in-favour-label">In Favour of Name & Address (Beneficiary)</div>
      <div class="in-favour-value">${item.name || item.description || '_____________________________________'}</div>
    </div>
    <table class="table">
      <thead><tr><th>DATE</th><th>PARTICULARS & DETAILS</th><th>AMOUNT</th></tr></thead>
      <tbody>${lineItemsHtml}</tbody>
      <tfoot><tr class="total-row"><td colspan="2" style="text-align:right;padding:8px;border:1px solid #000;">TOTAL EXPENDITURE</td><td style="text-align:right;padding:8px;border:1px solid #000;">${fmtMoney(item.amount, baseCurrency)}</td></tr></tfoot>
    </table>
    <div class="signature-section">
      <div class="two-column">
        <div class="signature-line"><label>Prepared By:</label><span class="line">${item.prepared_by_name || 'System User'}</span></div>
        <div class="signature-line"><label>Vote & Sub-head:</label><span class="line">${item.vote_and_subhead || 'N/A'}</span></div>
      </div>
      <div class="two-column">
        <div class="signature-line"><label>Source Account:</label><span class="line">${item.bank_account_name || 'Physical Cash Vault'}</span></div>
        <div class="signature-line"><label>Authorised By:</label><span class="line">${item.authorised_by_name || '________________'}</span></div>
      </div>
    </div>
    ${item.cheque_number || item.bank_name ? `
    <div class="cheque-section">
      <div style="margin-bottom:6px;"><strong>Cheque No:</strong> ${item.cheque_number || '_______'} &nbsp;|&nbsp; <strong>Bank:</strong> ${item.bank_name || '_______'} &nbsp;|&nbsp; <strong>Issued By:</strong> ${item.cheque_by || '_______'}</div>
      <div><strong>Date Prepared:</strong> ${formatDate(item.cheque_prepared_date ?? undefined)} &nbsp;|&nbsp; <strong>Date Signed:</strong> ${formatDate(item.cheque_signed_date ?? undefined)}</div>
    </div>` : ''}
    <div style="margin-top:24px;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:12px;">
      <div><strong>Collected By:</strong> ${item.collected_by_name || item.collected_by_other || '________________________'}</div>
      <div><strong>Recipient Signature:</strong> ________________________</div>
      <div><strong>Official Stamp:</strong> [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</div>
    </div>
  </div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Dual Print Engine 2: Concise Disbursement Receipt ────────────────────────
function triggerPrintReceipt(item: Expense, schoolName?: string, baseCurrency = '₦') {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print receipts.'); return; }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Disbursement Receipt - ${item.voucher_number || item.id}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-w: 420px; margin: 0 auto; color: #111; }
    .text-center { text-align: center; }
    .border-b { border-bottom: 1px dashed #444; padding-bottom: 12px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
    .bold { font-weight: bold; }
    .amount { font-size: 20px; margin: 16px 0; text-align: center; border: 2px solid #111; padding: 10px; font-weight: 800; }
    .no-print { margin-bottom: 20px; text-align: center; }
    .btn { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: #f0f0f0; font-weight: bold; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="btn" style="background:#dc2626;color:#fff;border:none;">🖨️ Print Receipt</button>
    <button onclick="window.close()" class="btn" style="margin-left:8px;">❌ Close Window</button>
  </div>
  <div class="text-center border-b">
    <h2 style="margin:0;font-size:16px;">${schoolName || 'SCHOOL MANAGEMENT SYSTEM'}</h2>
    <p style="margin:4px 0 0;font-size:12px;">OFFICIAL DISBURSEMENT RECEIPT</p>
  </div>
  <div class="row"><span>Voucher No:</span><span class="bold">${item.voucher_number || item.reference || `EXP-${item.id}`}</span></div>
  <div class="row"><span>Disbursed On:</span><span>${formatDate(item.expense_date)}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Category:</span><span class="bold">${item.category_name || 'General Expense'}</span></div>
  <div class="row"><span>In Favour Of:</span><span>${item.name || 'Vendor / Contractor'}</span></div>
  <div class="row"><span>Payment Method:</span><span class="capitalize">${item.payment_method || 'Bank Transfer'}</span></div>
  <div class="row"><span>Source Account:</span><span class="bold">${item.bank_account_name || 'Physical Cash Vault'}</span></div>
  <div class="amount">${fmtMoney(item.amount, baseCurrency)}</div>
  ${item.foreign_currency ? `<div class="row" style="color:#dc2626;"><span>Foreign Outflow:</span><span class="bold">${item.foreign_currency} ${item.foreign_amount}</span></div>` : ''}
  <div class="border-b"></div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Prepared by ${item.prepared_by_name || 'System User'}.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Smart Compliance Edit Modal ──────────────────────────────────────────────
function EditExpenseModal({ open, item, onClose, onSave, loading }: any) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (item) {
      setForm({
        // Only send editable compliance fields via PATCH:
        name: item.name || '',
        vote_and_subhead: item.vote_and_subhead || '',
        description: item.description || '',
        notes: item.notes || '',
        cheque_number: item.cheque_number || '',
        bank_name: item.bank_name || '',
        cheque_by: item.cheque_by || '',
      });
    }
  }, [item]);

  if (!open || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(item.id, form);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase mb-1";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Edit3 className="h-4 w-4" /> Edit Expenditure Record (#{item.voucher_number || item.id})
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Immutable Ledger Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Financial Compliance Guard:</strong> Amount (<strong>{fmtMoney(item.amount)}</strong>) and Source Account (<strong>{item.bank_account_name || 'Cash Vault'}</strong>) are strictly locked to protect bank ledger integrity. To correct an amount, delete this record and issue a fresh voucher.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>In Favour Of (Beneficiary)</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vote & Sub-head</label>
              <input type="text" value={form.vote_and_subhead} onChange={e => setForm({ ...form, vote_and_subhead: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Cheque Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>Cheque #</label><input type="text" value={form.cheque_number} onChange={e => setForm({ ...form, cheque_number: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Bank Name</label><input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Issued By</label><input type="text" value={form.cheque_by} onChange={e => setForm({ ...form, cheque_by: e.target.value })} className={inputCls} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Compliance Updates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, item, onConfirm, onCancel, loading }: any) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Reverse & Delete Voucher</h3>
        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-800">{item.voucher_number || `EXP-${item.id}`}</strong> ({fmtMoney(item.amount)})? This will atomically credit money back into the source bank account or cash vault.
        </p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-md shadow-red-200">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete & Credit Safe
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Elevated Slide-Out Audit Drawer ──────────────────────────────────────────
function AuditDrawer({ item, onClose, onDelete, onEdit, canDelete, canEdit, schoolName, baseCurrency, settings }: any) {
  if (!item) return null;

  const windowHours = settings?.reversal_window_hours ?? 24;
  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
  const isExpired = windowHours > 0 && hoursOld > windowHours;

  let parsedLineItems: any[] = [];
  try {
    parsedLineItems = typeof item.line_items_json === 'string' ? JSON.parse(item.line_items_json) : item.line_items_json || [];
  } catch {}

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Expenditure Voucher Audit</span>
            <h3 className="text-base font-bold truncate max-w-[320px]">{item.voucher_number || item.reference || `EXP-${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Disbursed</p>
              <p className="text-2xl font-black text-slate-900">{fmtMoney(item.amount, baseCurrency)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-bold uppercase px-2.5 py-1 bg-red-100 text-red-800 rounded-md">
                {item.category_name || 'Expense'}
              </span>
              <span className="text-[11px] text-slate-500 capitalize">{item.payment_method || 'transfer'}</span>
            </div>
          </div>

          {/* Itemized Sub-table Breakdown */}
          {Array.isArray(parsedLineItems) && parsedLineItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Itemized Line Items Breakdown</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                    <tr><th className="p-2">Date</th><th className="p-2">Particulars</th><th className="p-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedLineItems.map((li: any, idx: number) => (
                      <tr key={idx}><td className="p-2 text-slate-500">{li.date || '—'}</td><td className="p-2 font-medium">{li.particular}</td><td className="p-2 text-right font-bold">{fmtMoney(li.amount, baseCurrency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Source Routing */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Source Account Debited</h4>
            <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                {item.payment_method === 'cash' ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{item.bank_account_name || 'Assigned Physical Cash Vault'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Disbursed on {formatDate(item.expense_date)}</p>
              </div>
            </div>
          </div>

          {/* Signatory Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signatory Authorization Routing</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">In Favour Of</span><span className="font-bold text-slate-800">{item.name || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Vote & Sub-head</span><span className="font-mono font-medium text-slate-800">{item.vote_and_subhead || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Prepared By</span><span className="font-medium text-slate-800">{item.prepared_by_name || 'System User'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Authorised By</span><span className="font-medium text-slate-800">{item.authorised_by_name || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Collected By</span><span className="font-medium text-slate-800">{item.collected_by_name || item.collected_by_other || '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-end flex-shrink-0">
          <button onClick={() => triggerPrintReceipt(item, schoolName, baseCurrency)} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs">
            <FileText className="h-3.5 w-3.5 text-red-600" /> Receipt
          </button>
          <button onClick={() => triggerPrintVoucher(item, schoolName, baseCurrency)} className="px-3.5 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 flex items-center gap-1.5 shadow-sm">
            <Printer className="h-3.5 w-3.5" /> Print A4 Voucher
          </button>
          {canEdit && (
            <button onClick={() => onEdit(item)} className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(item)}
              disabled={isExpired}
              title={isExpired ? `Reversal grace period (${windowHours}h) expired` : 'Delete & Reverse'}
              className="px-3.5 py-2 bg-red-50 text-red-700 font-bold text-xs rounded-xl hover:bg-red-100 border border-red-200 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> {isExpired ? 'Expired' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Master Consolidated Expense Page ──────────────────────────────────────────
export default function ConsolidatedExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user, schoolInfo } = useAuth();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canViewExpense   = user?.is_superuser || hasPermission('finance.view_expensemodel');
  const canEditExpense   = user?.is_superuser || hasPermission('finance.change_expensemodel');
  const canDeleteExpense = user?.is_superuser || hasPermission('finance.delete_expensemodel');

  // Filter State
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [sessionId, setSessionId]           = useState('');
  const [periodId, setPeriodId]             = useState('');
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');

  const [data, setData]                     = useState<Expense[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [pageError, setPageError]           = useState<string | null>(null);

  // Reference Data
  const [categories, setCategories]         = useState<ExpenseCategory[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<any[]>([]);
  const [sessions, setSessions]             = useState<any[]>([]);
  const [settings, setSettings]             = useState<any>(null);

  // Modals & Drawer
  const [selectedItem, setSelectedItem]     = useState<Expense | null>(null);
  const [editModal, setEditModal]           = useState<{ open: boolean; item: Expense | null }>({ open: false, item: null });
  const [deleteModal, setDeleteModal]       = useState<{ open: boolean; item: Expense | null }>({ open: false, item: null });
  const [actionLoading, setActionLoading]   = useState(false);

  const [toasts, setToasts]                 = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(categoryFilter || searchQuery.trim() || sessionId || periodId || startDate || endDate);

  const clearAllFilters = () => {
    setCategoryFilter('');
    setSearchQuery('');
    setSessionId('');
    setPeriodId('');
    setStartDate('');
    setEndDate('');
  };

  // 1. Fetch References
  useEffect(() => {
    Promise.all([
      expenseCategoriesAPI.list().catch(() => []),
      academicCalendarAPI.listSessions().catch(() => []),
      academicCalendarAPI.listSessionPeriods().catch(() => []),
      financeSettingsAPI.get().catch(() => ({})),
    ]).then(([catsData, sessData, spData, settingsData]) => {
      setCategories(Array.isArray(catsData) ? catsData : (catsData as any)?.results ?? []);
      setSessions(Array.isArray(sessData) ? sessData : (sessData as any)?.results ?? []);
      setSessionPeriods(Array.isArray(spData) ? spData : (spData as any)?.results ?? []);
      setSettings(settingsData);
    });
  }, []);

  const availablePeriods = useMemo(() => {
    if (!sessionId) return [];
    return sessionPeriods
      .filter((sp: any) => String(sp.session?.id) === String(sessionId))
      .map((sp: any) => sp.period)
      .filter(Boolean);
  }, [sessionId, sessionPeriods]);

  const baseCurrencySymbol = settings?.currency_config?.base_currency === 'USD' ? '$' : '₦';

  // 2. Build Query Params
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (categoryFilter)                       params.category            = categoryFilter;
    if (searchQuery.trim())                   params.search              = searchQuery.trim();
    if (sessionId)                            params.session_id          = sessionId;
    if (periodId)                             params.academic_period_id  = periodId;
    if (startDate)                            params.start_date          = startDate;
    if (endDate)                              params.end_date            = endDate;
    return params;
  }, [page, categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  // 3. Fetch List Data
  const fetchData = useCallback(async () => {
    if (!canViewExpense) return;
    setLoading(true); setPageError(null);
    try {
      const response = await expenseAPI.list(buildParams());
      const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
      const totalCount = typeof (response as any)?.count === 'number' ? (response as any).count : results.length;
      setData(results);
      setTotal(totalCount);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams, canViewExpense]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  // 4. Save Compliance Updates
  const handleEditSave = async (id: number, payload: any) => {
    setActionLoading(true);
    try {
      await expenseAPI.update(id, payload);
      showToast('success', 'Expenditure metadata updated successfully.');
      setEditModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setActionLoading(false); }
  };

  // 5. Delete & Reverse Voucher
  const handleDeleteSubmit = async () => {
    if (!deleteModal.item) return;
    setActionLoading(true);
    try {
      await expenseAPI.delete(deleteModal.item.id);
      showToast('success', 'Expenditure voucher deleted and safe credited atomically.');
      setDeleteModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setActionLoading(false); }
  };

  const getExportRows = useCallback(async (): Promise<Expense[]> => {
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response = await expenseAPI.list(params);
    return Array.isArray(response) ? response : (response as any)?.results ?? [];
  }, [buildParams]);

  if (!canViewExpense) {
    return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing expenditure view permissions.</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Drawer */}
      <AuditDrawer
        item={selectedItem} onClose={() => setSelectedItem(null)}
        onDelete={(item: Expense) => setDeleteModal({ open: true, item })}
        onEdit={(item: Expense) => { setSelectedItem(null); setEditModal({ open: true, item }); }}
        canDelete={canDeleteExpense} canEdit={canEditExpense}
        schoolName={schoolInfo?.name} baseCurrency={baseCurrencySymbol} settings={settings}
      />

      {/* Compliance Edit Modal */}
      <EditExpenseModal
        open={editModal.open} item={editModal.item}
        onClose={() => setEditModal({ open: false, item: null })}
        onSave={handleEditSave} loading={actionLoading}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        open={deleteModal.open} item={deleteModal.item}
        onConfirm={handleDeleteSubmit} onCancel={() => setDeleteModal({ open: false, item: null })}
        loading={actionLoading}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-md shadow-red-200">
              <ArrowDownRight className="h-5 w-5 text-white" />
            </div>
            Master Expenditure Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Audit, print vouchers, and track institutional expenditures</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/finance/expenses/create')} className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-sm rounded-xl shadow-md shadow-red-200 hover:from-red-700 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record New Expense
          </button>
          <ExpenseExporter schoolName={schoolInfo?.name} getExportRows={getExportRows} baseCurrency={baseCurrencySymbol} />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search voucher #, beneficiary, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPeriodId(''); }} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium">
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
          </select>

          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!sessionId || availablePeriods.length === 0} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">All Periods</option>
            {availablePeriods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              max={todayStr}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium"
            />
            <span className="text-slate-300 text-xs font-bold">—</span>
            <input
              type="date"
              max={todayStr}
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                title="Clear all active filters"
                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <FilterX className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
            <button onClick={fetchData} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-red-600' : ''}`} /></button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="text-xs text-slate-400 font-medium">Loading institutional expenditure vouchers...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center text-red-600 font-medium">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <ArrowDownRight className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700">No expenditure vouchers found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or record a new institutional expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5 min-w-[200px]">Voucher #</th>
                  <th className="px-4 py-3.5 min-w-[180px]">In Favour Of</th>
                  <th className="px-4 py-3.5">Source Account</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const windowHours = settings?.reversal_window_hours ?? 24;
                  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
                  const isExpired = windowHours > 0 && hoursOld > windowHours;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-bold text-slate-800">{item.voucher_number || item.reference || `EXP-${item.id}`}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{item.category_name || 'General Expense'}</p>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <span className="text-slate-800 font-bold">{item.name || '—'}</span>
                        {item.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {item.bank_account_name || 'Physical Cash Vault'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {fmtMoney(item.amount, baseCurrencySymbol)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 font-medium">
                        {item.payment_method || 'transfer'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                        {formatDate(item.expense_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => triggerPrintReceipt(item, schoolInfo?.name, baseCurrencySymbol)} title="Print Disbursement Receipt" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                            <FileText className="h-4 w-4" />
                          </button>
                          <button onClick={() => triggerPrintVoucher(item, schoolInfo?.name, baseCurrencySymbol)} title="Print Official A4 Voucher" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                            <Printer className="h-4 w-4" />
                          </button>
                          {canEditExpense && (
                            <button onClick={() => setEditModal({ open: true, item })} title="Edit Compliance Metadata" className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors">
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {canDeleteExpense && (
                            <button
                              onClick={() => setDeleteModal({ open: true, item })}
                              disabled={isExpired}
                              title={isExpired ? `Reversal grace period (${windowHours}h) expired` : 'Reverse & Delete Voucher'}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItem(item)} title="Open Audit Drawer" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE) || 1} ({total} records)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}