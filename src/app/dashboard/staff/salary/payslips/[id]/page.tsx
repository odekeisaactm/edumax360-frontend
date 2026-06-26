'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import { SalaryRecord } from '@/lib/salary_management.types';
import {
  FileText, ArrowLeft, CheckCircle, AlertCircle, Loader2,
  X, Wallet, Shield, Percent, Landmark, MinusCircle,
  Check, UserCircle, Building2, Calendar, Info, Printer, Gift,
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
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number | undefined | null): string {
  if (!amount) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

// ─── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Wallet className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Mark as Paid?</h3>
        <p className="text-sm text-slate-500 text-center mb-6">This will update the payment status to Paid and set the payment date to today.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : <><Check className="h-4 w-4" /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Payslip Row ────────────────────────────────────────────────────
function Row({ label, value, isTotal }: { label: string; value: string; isTotal?: boolean }) {
  return (
    <tr className={`border-b border-slate-100 last:border-0 ${isTotal ? 'bg-slate-50/80' : ''}`}>
      <td className={`py-2.5 pr-4 ${isTotal ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{label}</td>
      <td className={`py-2.5 text-right ${isTotal ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>{value}</td>
    </tr>
  );
}

// ─── Print Payslip (Pure HTML Print Window) ───────────────────────────────
function buildPayslipHTML(record: any, schoolName: string): string {
  const staff = record.staff_detail || {};
  const monthName = record.month_name || '';
  const statusColors: Record<string, string> = {
    paid: '#059669', pending: '#d97706', partially_paid: '#ea580c', not_processed: '#64748b',
  };
  const statusColor = statusColors[record.payment_status] || '#64748b';
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });

  const buildIncomeRows = () => {
    let rows = '';
    Object.entries(record.basic_components_breakdown || {}).forEach(([code, comp]: [string, any]) => {
      rows += `<tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b;">${comp.name}</td><td style="padding:8px 12px;color:#64748b;text-align:center">${comp.percentage}%</td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(comp.amount)}</td></tr>`;
    });
    Object.entries(record.allowances_breakdown || {}).forEach(([name, allow]: [string, any]) => {
      if (parseFloat(allow.amount) > 0) {
        rows += `<tr style="background:#f0fdf4"><td style="padding:8px 12px;color:#64748b;">${name} (Allowance)</td><td style="padding:8px 12px;"></td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(allow.amount)}</td></tr>`;
      }
    });
    if (record.bonus > 0) {
      rows += `<tr style="background:#ffffff"><td style="padding:8px 12px;color:#64748b;">Bonus</td><td style="padding:8px 12px;"></td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(record.bonus)}</td></tr>`;
    }
    Object.entries(record.additional_income || {}).forEach(([name, amount]: [string, any]) => {
      if (parseFloat(amount) > 0) rows += `<tr style="background:#ffffff"><td style="padding:8px 12px;color:#64748b;">${name}</td><td style="padding:8px 12px;"></td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(amount)}</td></tr>`;
    });
    return rows;
  };

  const buildDeductionRows = (data: any, title: string) => {
    let rows = `<tr style="background:#f8fafc"><td colspan="3" style="padding:8px 12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:11px">${title}</td></tr>`;
    Object.entries(data || {}).forEach(([name, ded]: [string, any]) => {
      const amt = typeof ded === 'object' ? ded?.amount : ded;
      if (parseFloat(amt || 0) > 0) {
        rows += `<tr style="background:#ffffff"><td style="padding:8px 12px;color:#64748b;">${name} ${ded?.percentage ? `(${ded.percentage}% of ${ded.based_on})` : ''}</td><td style="padding:8px 12px;"></td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(amt)}</td></tr>`;
      }
    });
    return rows;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Payslip - ${staff.full_name || 'Staff'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 30px; max-width: 700px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; }
    .school-name { font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 4px; }
    .payslip-title { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 2px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .meta-item { margin-bottom: 8px; }
    .meta-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .meta-value { font-size: 13px; color: #1e293b; font-weight: 500; }
    .status-box { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${statusColor}; border: 1.5px solid ${statusColor}; background: ${statusColor}18; }
    table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 16px; }
    th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    td { padding: 8px 12px; font-size: 12px; }
    .total-row { background: #f8fafc !important; font-weight: 700; }
    .net-pay-box { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .net-label { font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .net-amount { font-size: 28px; font-weight: 800; }
    .footer { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 24px; }
    @media print { body { padding: 15px; } @page { margin: 15mm; size: A4 portrait; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="payslip-title">Payslip</div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-item"><div class="meta-label">Name</div><div class="meta-value">${staff.full_name || 'N/A'}</div></div>
      <div class="meta-item"><div class="meta-label">Staff ID</div><div class="meta-value">${staff.staff_id || 'N/A'}</div></div>
      <div class="meta-item"><div class="meta-label">Department</div><div class="meta-value">${staff.department_name || 'N/A'}</div></div>
    </div>
    <div style="text-align: right;">
      <div class="meta-item"><div class="meta-label">Period</div><div class="meta-value">${monthName} ${record.year}</div></div>
      <div class="meta-item"><div class="meta-label">Payment Date</div><div class="meta-value">${record.paid_date ? new Date(record.paid_date).toLocaleDateString() : 'Pending'}</div></div>
      <div class="meta-item" style="margin-top:8px"><span class="status-box">${record.payment_status.replace('_', ' ')}</span></div>
    </div>
  </div>

  <table>
    <thead><tr><th>Income Component</th><th style="text-align:center">%</th><th style="text-align:right">Amount (₦)</th></tr></thead>
    <tbody>${buildIncomeRows()}</tbody>
    <tfoot><tr class="total-row"><td colspan="2" style="padding:10px 12px;color:#4f46e5">Total Payable (A)</td><td style="padding:10px 12px;text-align:right;color:#4f46e5;font-size:14px">${fmtMoney(record.total_income)}</td></tr></tfoot>
  </table>

  <table>
    <thead><tr><th>Deductions</th><th></th><th style="text-align:right">Amount (₦)</th></tr></thead>
    <tbody>
      ${buildDeductionRows(record.statutory_deductions, 'Statutory (B)')}
      <tr class="total-row"><td colspan="2" style="padding:10px 12px;">Sub-Total Statutory (B)</td><td style="padding:10px 12px;text-align:right;">${fmtMoney(record.total_statutory_deductions)}</td></tr>

      ${buildDeductionRows(record.other_deductions, 'Other Deductions (C)')}
      <tr class="total-row"><td colspan="2" style="padding:10px 12px;">Sub-Total Other (C)</td><td style="padding:10px 12px;text-align:right;">${fmtMoney(record.total_other_deductions)}</td></tr>

      <tr style="background:#ffffff"><td style="padding:8px 12px;color:#64748b;">PAYE Tax</td><td style="padding:8px 12px;"></td><td style="padding:8px 12px;color:#1e293b;text-align:right;font-weight:600">${fmtMoney(record.monthly_tax)}</td></tr>
      <tr class="total-row"><td colspan="2" style="padding:10px 12px;">Sub-Total Tax (D)</td><td style="padding:10px 12px;text-align:right;">${fmtMoney(record.total_taxation)}</td></tr>
    </tbody>
  </table>

  <div class="net-pay-box">
    <div class="net-label">Take Home Pay (A - B - C - D)</div>
    <div class="net-amount">${fmtMoney(record.net_salary)}</div>
  </div>

  <div class="footer">
    <p><strong>Generated:</strong> ${now}</p>
    <p style="margin-top:4px">This is a computer-generated payslip.</p>
    <p style="margin-top:4px">${schoolName}</p>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}


// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PayslipDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const { hasPermission, user, schoolInfo } = useAuth();

  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('finance.change_salaryrecord');

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts((prev) => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts((prev) => prev.filter((t) => t.id !== tid));

  // ── Fetch Data ──
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await payrollAPI.getRecord(id) as any;
        const data = res?.data || res;
        setRecord(data);
      } catch (err) {
        setError(extractError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Mark as Paid ──
  const handleMarkPaid = async () => {
    if (!record) return;
    setMarkingPaid(true);
    try {
      await payrollAPI.markPaid(record.id);
      showToast('success', 'Payment status updated to Paid.');
      setShowMarkPaidModal(false);
      const res = await payrollAPI.getRecord(record.id) as any;
      setRecord(res?.data || res);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setMarkingPaid(false);
    }
  };

  // ── Print Payslip ──
  const handlePrint = () => {
    if (!record) return;
    const html = buildPayslipHTML(record, schoolInfo?.name || 'School');
    const win = window.open('', '_blank');
    if (!win) {
      showToast('error', 'Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  // ── UI States ──
  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm font-medium">Loading payslip…</span></div>
    </div>
  );

  if (error || !record) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{error || 'Payslip not found.'}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">Go Back</button>
      </div>
    </div>
  );

  const staff = (record.staff_detail as any) || {};
  const monthName = record.month_name || new Date(record.year, record.month - 1).toLocaleString('en-US', { month: 'long' });

  const statusConfig: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partially_paid: { label: 'Partially Paid', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Pending', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    not_processed: { label: 'Not Processed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const currentStatus = statusConfig[record.payment_status] || statusConfig.not_processed;

  const allowancesBreakdown = (record as any).allowances_breakdown || {};
  const hasAllowances = Object.keys(allowancesBreakdown).some(k => parseFloat(allowancesBreakdown[k]?.amount) > 0);

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal open={showMarkPaidModal} onClose={() => setShowMarkPaidModal(false)} onConfirm={handleMarkPaid} loading={markingPaid} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Payslip Details</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print Payslip
          </button>
          {canManage && record.payment_status !== 'paid' && (
            <button onClick={() => setShowMarkPaidModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-xl shadow-sm transition-all">
              <Wallet className="h-4 w-4" /> Mark as Paid
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">

        {/* Section 1: Staff Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-blue-100 bg-blue-50/30 flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-blue-900">PAYSLIP</h2>
            <span className={`ml-auto inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${currentStatus.cls}`}>
              {currentStatus.label}
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3"><UserCircle className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-xs">Name</p><p className="font-semibold text-slate-800">{staff.full_name || 'N/A'}</p></div></div>
              <div className="flex items-start gap-3"><Info className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-xs">Staff ID</p><p className="font-mono font-medium text-slate-700">{staff.staff_id || 'N/A'}</p></div></div>
              <div className="flex items-start gap-3"><Building2 className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-xs">Department</p><p className="font-medium text-slate-700">{staff.department_name || 'N/A'}</p></div></div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3"><Calendar className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-xs">Period</p><p className="font-medium text-slate-700">{monthName} {record.year}</p></div></div>
              <div className="flex items-start gap-3"><Wallet className="h-4 w-4 text-slate-400 mt-0.5" /><div><p className="text-slate-400 text-xs">Payment Date</p><p className="font-medium text-slate-700">{record.paid_date ? new Date(record.paid_date).toLocaleDateString() : 'Pending'}</p></div></div>
            </div>
          </div>
        </div>

        {/* Section 2: Income */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><Wallet className="h-4 w-4 text-green-600" /></div>
            <h3 className="text-sm font-bold text-slate-800">Income & Allowances</h3>
          </div>
          <div className="p-6">
            {/* Basic Components */}
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-slate-100"><th className="py-2 pr-4">Component</th><th className="py-2 pr-4">%</th><th className="py-2 text-right">Amount (₦)</th></tr></thead>
              <tbody>
                {Object.entries(record.basic_components_breakdown || {}).map(([code, comp]: [string, any]) => (
                  <tr key={code} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{comp.name}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{comp.percentage}%</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{fmtMoney(comp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Allowances Breakdown — NEW */}
            {hasAllowances && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" /> Allowances
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(allowancesBreakdown).map(([name, allow]: [string, any]) => (
                      parseFloat(allow.amount) > 0
                        ? <Row key={name} label={name} value={fmtMoney(allow.amount)} />
                        : null
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Additional Income */}
            {(parseFloat(record.bonus) > 0 || Object.keys(record.additional_income || {}).length > 0) && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Additional Income</p>
                <table className="w-full text-sm">
                  <tbody>
                    {parseFloat(record.bonus) > 0 && <Row label="Bonus" value={fmtMoney(record.bonus)} />}
                    {Object.entries(record.additional_income || {}).map(([name, amount]: [string, any]) => (
                      parseFloat(amount) > 0 ? <Row key={name} label={name} value={fmtMoney(amount)} /> : null
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 p-3.5 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
              <span className="font-bold text-blue-800">Total Payable (A)</span>
              <span className="text-lg font-bold text-blue-800">{fmtMoney(record.total_income)}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Deductions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><MinusCircle className="h-4 w-4 text-red-600" /></div>
            <h3 className="text-sm font-bold text-slate-800">Deductions</h3>
          </div>
          <div className="p-6 space-y-6">

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Statutory (B)</p>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(record.statutory_deductions || {}).map(([name, ded]: [string, any]) => {
                    const amt = typeof ded === 'object' ? ded?.amount : ded;
                    return parseFloat(amt) > 0 ? (
                      <tr key={name} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-4 text-slate-500">{name} {ded?.percentage ? `(${ded.percentage}% of ${ded.based_on})` : ''}</td>
                        <td className="py-2.5 text-right font-medium text-slate-700">{fmtMoney(amt)}</td>
                      </tr>
                    ) : null;
                  })}
                  <Row label="Sub-Total Statutory (B)" value={fmtMoney(record.total_statutory_deductions)} isTotal />
                </tbody>
              </table>
            </div>

            {Object.keys(record.other_deductions || {}).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Other Deductions (C)</p>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(record.other_deductions || {}).map(([name, ded]: [string, any]) => {
                      const amt = typeof ded === 'object' ? ded?.amount : ded;
                      return parseFloat(amt) > 0 ? <Row key={name} label={name} value={fmtMoney(amt)} /> : null;
                    })}
                    <Row label="Sub-Total Other (C)" value={fmtMoney(record.total_other_deductions)} isTotal />
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Taxation (D)</p>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="PAYE Tax" value={fmtMoney(record.monthly_tax)} />
                  {parseFloat(record.other_taxes as string) > 0 && <Row label="Other Taxes" value={fmtMoney(record.other_taxes)} />}
                  <Row label="Sub-Total Tax (D)" value={fmtMoney(record.total_taxation)} isTotal />
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Section 4: Take Home Pay */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl shadow-lg p-8 text-center text-white">
          <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest mb-1">Take Home Pay</p>
          <p className="text-indigo-200 text-xs mb-4">A - B - C - D</p>
          <h2 className="text-4xl font-extrabold tracking-tight">{fmtMoney(record.net_salary)}</h2>
        </div>

        {/* Section 5: Tax Info & Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h5 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Landmark className="h-4 w-4 text-slate-500" /> Tax Information</h5>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Annual Gross Income</span><span className="font-medium text-slate-700">{fmtMoney(record.annual_gross_income)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total Reliefs</span><span className="font-medium text-slate-700">{fmtMoney(record.total_reliefs)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Taxable Income</span><span className="font-medium text-slate-700">{fmtMoney(record.taxable_income)}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500 font-semibold">Effective Tax Rate</span><span className="font-bold text-indigo-600">{record.effective_tax_rate}%</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h5 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Info className="h-4 w-4 text-slate-500" /> Additional Info</h5>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Amount Paid</span><span className="font-medium text-slate-700">{fmtMoney(record.amount_paid)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Balance Due</span><span className="font-medium text-slate-700">{fmtMoney(record.balance_due)}</span></div>
            </div>
            {record.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{record.notes}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}