'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI } from '@/lib/salary_management.service';
import { SalaryRecord } from '@/lib/salary_management.types';
import {
  FileText, ArrowLeft, CheckCircle, AlertCircle, Loader2,
  X, Wallet, Shield, Percent, Landmark, MinusCircle,
  Check, UserCircle, Building2, Calendar, Info, Printer, Gift, Mail
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

function getImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />}
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Wallet className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Mark as Paid?</h3>
        <p className="text-sm text-slate-500 text-center mb-6">This will update the payment status to Paid and set the payment date to today.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts((prev) => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts((prev) => prev.filter((t) => t.id !== tid));

  useEffect(() => {
    if (!showPrintPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPrintPreview(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintPreview]);

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
      await payrollAPI.markPaid({ record_ids: [record.id], amount_paid: record.net_salary });
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

  // ── Email Payslip ──
  const handleEmailPayslip = async () => {
    if (!record) return;
    setEmailing(true);
    try {
      await payrollAPI.emailPayslips({ record_ids: [record.id], force_resend: true });
      showToast('success', 'Payslip queued for email dispatch.');
      setRecord(prev => prev ? { ...prev, payslip_emailed_at: new Date().toISOString() } : prev);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setEmailing(false);
    }
  };

  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm font-medium">Loading payslip…</span></div>
    </div>
  );

  if (error || !record) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
        <p className="text-sm text-rose-600 mb-4">{error || 'Payslip not found.'}</p>
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

      {/* Print CSS constraints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* The overlay wrapper must NOT stay fixed on print — a fixed
             containing block gets repeated on every printed page (that's
             what caused the double-print). Screen-only content is hidden
             with display:none (via print:hidden below) instead of
             visibility:hidden, so it doesn't reserve blank page space. */
          #print-overlay-root {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: none !important;
            backdrop-filter: none !important;
            display: block !important;
          }

          #receipt-print-area {
            position: static !important;
            left: auto;
            top: auto;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
          }

          #receipt-print-area .print-body {
            padding: 0 !important;
          }

          @page { margin: 10mm; size: A4 portrait; }
        }
      `}} />

      {/* Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Payslip Details</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button onClick={handleEmailPayslip} disabled={emailing} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
              {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email
            </button>
          )}
          <button onClick={() => setShowPrintPreview(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print
          </button>
          {canManage && record.payment_status !== 'paid' && (
            <button onClick={() => setShowMarkPaidModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-xl shadow-sm transition-all">
              <Wallet className="h-4 w-4" /> Mark as Paid
            </button>
          )}
        </div>
      </div>

      <div className="print:hidden space-y-4">

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

            {(parseFloat(record.bonus as string) > 0 || Object.keys(record.additional_income || {}).length > 0) && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Additional Income</p>
                <table className="w-full text-sm">
                  <tbody>
                    {parseFloat(record.bonus as string) > 0 && <Row label="Bonus" value={fmtMoney(record.bonus)} />}
                    {Object.entries(record.additional_income || {}).map(([name, amount]: [string, any]) => (
                      parseFloat(amount as string) > 0 ? <Row key={name} label={name} value={fmtMoney(amount as string)} /> : null
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
              <div className="flex justify-between"><span className="text-slate-400">Emailed At</span><span className="font-medium text-slate-700">{record.payslip_emailed_at ? new Date(record.payslip_emailed_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not sent yet'}</span></div>
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

      {/* ── PRINTABLE PAYSLIP OVERLAY (In-DOM approach with Original Tables & New Header) ── */}
      {showPrintPreview && (
        <div id="print-overlay-root" onClick={() => setShowPrintPreview(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* Action bar — hidden on print */}
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintPreview(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button onClick={handleEmailPayslip} disabled={emailing} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50">
                    {emailing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Email
                  </button>
                )}
                <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            <div className="print-body p-8 print:p-3 text-slate-900">

              {/* New Letterhead */}
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
                  Payslip
                </span>
              </div>

              {/* Meta Grid (Old Structure, styled properly) */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Name</span><span className="font-medium text-slate-900">{staff.full_name || 'N/A'}</span></div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Staff ID</span><span className="font-medium text-slate-900">{staff.staff_id || 'N/A'}</span></div>
                  <div><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Department</span><span className="font-medium text-slate-900">{staff.department_name || 'N/A'}</span></div>
                </div>
                <div className="text-right">
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Period</span><span className="font-medium text-slate-900">{monthName} {record.year}</span></div>
                  <div className="mb-2"><span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Payment Date</span><span className="font-medium text-slate-900">{record.paid_date ? new Date(record.paid_date).toLocaleDateString() : 'Pending'}</span></div>
                  <div className="mt-2"><span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentStatus.cls}`}>{currentStatus.label}</span></div>
                </div>
              </div>

              {/* Earnings Table (Original Format) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Income Component</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-600 uppercase">%</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 uppercase">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Basic Components */}
                    {Object.entries(record.basic_components_breakdown || {}).map(([code, comp]: [string, any]) => (
                      <tr key={code} className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">{comp.name}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-center">{comp.percentage}%</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(comp.amount)}</td>
                      </tr>
                    ))}

                    {/* Allowances */}
                    {Object.entries(allowancesBreakdown).map(([name, allow]: [string, any]) => (
                      parseFloat(allow.amount) > 0 ? (
                        <tr key={name} className="bg-emerald-50/30">
                          <td className="px-4 py-2.5 text-slate-600">{name} (Allowance)</td>
                          <td className="px-4 py-2.5"></td>
                          <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(allow.amount)}</td>
                        </tr>
                      ) : null
                    ))}

                    {/* Bonus & Additional Income */}
                    {parseFloat(record.bonus as string) > 0 && (
                      <tr className="bg-white">
                        <td className="px-4 py-2.5 text-slate-600">Bonus</td>
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(record.bonus)}</td>
                      </tr>
                    )}
                    {Object.entries(record.additional_income || {}).map(([name, amount]: [string, any]) => (
                      parseFloat(amount as string) > 0 ? (
                        <tr key={name} className="bg-white">
                          <td className="px-4 py-2.5 text-slate-600">{name}</td>
                          <td className="px-4 py-2.5"></td>
                          <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amount as string)}</td>
                        </tr>
                      ) : null
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-3 text-indigo-700 font-bold">Total Payable (A)</td>
                      <td className="px-4 py-3 text-right text-indigo-700 font-bold text-base">{fmtMoney(record.total_income)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deductions Table (Original Format) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Deductions</th>
                      <th className="px-4 py-2.5"></th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 uppercase">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">

                    {/* Statutory Block */}
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Statutory (B)</td>
                    </tr>
                    {Object.entries(record.statutory_deductions || {}).map(([name, ded]: [string, any]) => {
                      const amt = typeof ded === 'object' ? ded?.amount : ded;
                      return parseFloat(amt) > 0 ? (
                        <tr key={name} className="bg-white">
                          <td className="px-4 py-2.5 text-slate-600">{name} {ded?.percentage ? `(${ded.percentage}% of ${ded.based_on})` : ''}</td>
                          <td className="px-4 py-2.5"></td>
                          <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                        </tr>
                      ) : null;
                    })}
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <td colSpan={2} className="px-4 py-2.5 font-bold text-slate-700">Sub-Total Statutory (B)</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmtMoney(record.total_statutory_deductions)}</td>
                    </tr>

                    {/* Other Deductions Block */}
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Other Deductions (C)</td>
                    </tr>
                    {Object.entries(record.other_deductions || {}).map(([name, ded]: [string, any]) => {
                      const amt = typeof ded === 'object' ? ded?.amount : ded;
                      return parseFloat(amt) > 0 ? (
                        <tr key={name} className="bg-white">
                          <td className="px-4 py-2.5 text-slate-600">{name}</td>
                          <td className="px-4 py-2.5"></td>
                          <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(amt)}</td>
                        </tr>
                      ) : null;
                    })}
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <td colSpan={2} className="px-4 py-2.5 font-bold text-slate-700">Sub-Total Other (C)</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmtMoney(record.total_other_deductions)}</td>
                    </tr>

                    {/* Tax Block */}
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600">PAYE Tax</td>
                      <td className="px-4 py-2.5"></td>
                      <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">{fmtMoney(record.monthly_tax)}</td>
                    </tr>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-3 font-bold text-slate-700">Sub-Total Tax (D)</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">{fmtMoney(record.total_taxation)}</td>
                    </tr>

                  </tbody>
                </table>
              </div>

              {/* Net Pay Box (Original Gradient Format) */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl p-6 text-center mb-8 shadow-md">
                <p className="text-[11px] uppercase font-semibold tracking-widest text-indigo-100 mb-1.5">Take Home Pay (A - B - C - D)</p>
                <p className="text-4xl font-extrabold">{fmtMoney(record.net_salary)}</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 mt-12 text-[11px]">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">System Generated</p>
                  <p className="text-slate-400 font-medium">Processed By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-slate-400 font-medium">Authorized Signature & Stamp</p>
                </div>
              </div>

              <p className="text-center text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-6">
                This is a computer-generated payslip. Contact Human Resources for any discrepancies.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}