'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, schoolInfoAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod } from '@/lib/types';
import {
  Search, AlertCircle, Check, X, Loader2, Users, FileText,
  RefreshCw, Eye, Wallet, Building2, ShieldMinus, ArrowRight, CreditCard, Printer, ExternalLink, User
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
}

function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (/^[A-Z]{2,6}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function cleanFeeDescription(desc: string): string {
  if (!desc) return '';
  const dashIdx = desc.indexOf('—');
  const base = (dashIdx >= 0 ? desc.slice(0, dashIdx) : desc).trim();
  return smartTitleCase(base);
}

// Red when there's still money owed, green when fully settled — used for every
// balance figure shown directly on screen (list view + drawer already had this
// logic in a couple of spots; this makes it consistent everywhere).
function balanceColorClass(balance: string | number | undefined): string {
  return parseFloat(String(balance ?? '0')) > 0 ? 'text-rose-600' : 'text-emerald-600';
}

const renderStatusBadge = (balanceStr: string, paidStr: string) => {
  const balance = parseFloat(balanceStr || '0');
  const paid = parseFloat(paidStr || '0');
  if (balance <= 0) return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-md uppercase tracking-wider">Paid</span>;
  if (paid > 0) return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black rounded-md uppercase tracking-wider">Partial</span>;
  return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black rounded-md uppercase tracking-wider">Unpaid</span>;
};

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Parent Billing Ledger Content ─────────────────────────────────────────────
function ParentBillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const urlSession = searchParams.get('session');
  const urlPeriod = searchParams.get('period');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [filterSessionId, setFilterSessionId] = useState<string>(urlSession || '');
  const [filterPeriodId, setFilterPeriodId] = useState<string>(urlPeriod || '');
  const [ledgerData, setLedgerData] = useState<any | null>(null);

  // Drawer state for 100% exact invoice page parity
  const [invoiceDrawer, setInvoiceDrawer] = useState<{ type: 'student'; parent: any; ledgerStudent: any } | { type: 'family'; parent: any } | null>(null);

  // Print state
  const [printData, setPrintData] = useState<{ kind: 'student_invoice'; parent: any; ledgerStudent: any } | { kind: 'family_statement'; parent: any } | null>(null);

  // Initialize Sessions & Periods
  useEffect(() => {
    const init = async () => {
      try {
        const [sessData, curSessRaw] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession()
        ]);
        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        setSessions(Array.isArray(sessData) ? sessData : []);
        const targetSessionId = urlSession || (curSess?.id ? curSess.id.toString() : (sessData[0]?.id?.toString() || ''));

        if (targetSessionId) {
          setFilterSessionId(targetSessionId);
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: Number(targetSessionId) });
          setPeriods(perData);
          if (!urlPeriod) {
            const currentP = perData.find(p => p.is_current);
            if (currentP) setFilterPeriodId(currentP.id.toString());
            else if (perData.length > 0) setFilterPeriodId(perData[0].id.toString());
          }
        }
      } catch (err) {
        showToast('error', 'Failed to initialize academic calendar.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [urlSession, urlPeriod]);

  useEffect(() => {
    schoolInfoAPI.get().then((d: any) => setSchoolInfo(d)).catch(() => setSchoolInfo(null));
  }, []);

  useEffect(() => {
    if (!loading && filterSessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
        .then(res => {
          setPeriods(res);
          if (res.length > 0 && !res.find(p => p.id.toString() === filterPeriodId)) {
            setFilterPeriodId(res[0].id.toString());
          }
        });
    }
  }, [filterSessionId, loading]);

  const fetchLedger = useCallback(async () => {
    if (!filterSessionId || !filterPeriodId) return;
    setDataLoading(true);
    try {
      const res = await feeAPI.getBillingLedger({
        session_id: filterSessionId,
        period_id: filterPeriodId,
        mode: 'parent'
      });
      const familyRecord = res.results?.[0] || res?.[0] || res;
      setLedgerData(familyRecord);
    } catch (error: any) {
      showToast('error', error?.response?.data?.detail || 'Failed to load billing details.');
    } finally {
      setDataLoading(false);
    }
  }, [filterSessionId, filterPeriodId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Breakdown helpers for drawer and print
  const getStudentBreakdown = useCallback((ledgerStudent: any) => {
    const items: { description: string; billed: number; discount: number; waived: number; paid: number; balance: number }[] = [];
    let billed = 0, discount = 0, waived = 0, paid = 0, balance = 0;

    if (ledgerStudent.invoice) {
      ledgerStudent.invoice.items?.forEach((it: any) => {
        items.push({
          description: cleanFeeDescription(it.description),
          billed: parseFloat(it.amount),
          discount: parseFloat(it.total_discount || '0'),
          waived: parseFloat(it.total_waived || '0'),
          paid: parseFloat(it.amount_paid || '0'),
          balance: parseFloat(it.balance || '0'),
        });
      });
      billed += parseFloat(ledgerStudent.invoice.total_amount);
      discount += parseFloat(ledgerStudent.invoice.total_discount);
      waived += parseFloat(ledgerStudent.invoice.total_waived);
      paid += parseFloat(ledgerStudent.invoice.amount_paid);
      balance += parseFloat(ledgerStudent.invoice.balance);
    }

    ledgerStudent.other_payments?.forEach((op: any) => {
      items.push({
        description: `${cleanFeeDescription(op.description)} (${op.category_display})`,
        billed: parseFloat(op.amount),
        discount: 0,
        waived: parseFloat(op.total_waived || '0'),
        paid: parseFloat(op.amount_paid),
        balance: parseFloat(op.balance),
      });
      billed += parseFloat(op.amount);
      waived += parseFloat(op.total_waived || '0');
      paid += parseFloat(op.amount_paid);
      balance += parseFloat(op.balance);
    });

    return { items, billed, discount, waived, paid, balance };
  }, []);

  // Rolls every ward's breakdown (+ the shared family invoice, if any) into one
  // family-wide total. Needed for the "print full statement" action — previously
  // missing from this page entirely, which is why there was no way to print
  // anything covering more than a single student's invoice.
  const getParentBreakdown = useCallback((parent: any) => {
    const children = (parent.students || []).map((ls: any) => ({ ledgerStudent: ls, breakdown: getStudentBreakdown(ls) }));
    let billed = 0, discount = 0, waived = 0, paid = 0, balance = 0;
    children.forEach((c: any) => { billed += c.breakdown.billed; discount += c.breakdown.discount; waived += c.breakdown.waived; paid += c.breakdown.paid; balance += c.breakdown.balance; });

    let family: any = null;
    if (parent.family_invoice) {
      family = {
        items: parent.family_invoice.items || [],
        invoice_number: parent.family_invoice.invoice_number,
        billed: parseFloat(parent.family_invoice.total_amount),
        discount: parseFloat(parent.family_invoice.total_discount),
        waived: parseFloat(parent.family_invoice.total_waived),
        paid: parseFloat(parent.family_invoice.amount_paid),
        balance: parseFloat(parent.family_invoice.balance),
      };
      billed += family.billed; discount += family.discount; waived += family.waived; paid += family.paid; balance += family.balance;
    }
    return { children, family, billed, discount, waived, paid, balance };
  }, [getStudentBreakdown]);

  const printStudentInvoice = (parent: any, ledgerStudent: any) => {
    setInvoiceDrawer(null);
    setPrintData({ kind: 'student_invoice', parent, ledgerStudent });
  };

  // Prints one consolidated statement across every ward + shared family fees —
  // the "general print" that was missing before, mirroring the staff ledger's
  // family statement.
  const printFamilyStatement = (parent: any) => {
    setInvoiceDrawer(null);
    setPrintData({ kind: 'family_statement', parent });
  };

  useEffect(() => {
    if (!printData) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [printData]);

  useEffect(() => {
    const onAfterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const renderPrintContent = () => {
    if (!printData) return null;
    const sessionObj = sessions.find(s => s.id.toString() === filterSessionId);
    const periodObj: any = periods.find((p: any) => p.id.toString() === filterPeriodId);
    const periodDisplay = periodObj?.name || periodObj?.period?.name || '';
    const sessionDisplay = sessionObj ? `${sessionObj.start_year}/${sessionObj.end_year}` : '';
    const printedOn = new Date().toLocaleString('en-GB');

    const Letterhead = () => (
      <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-4 mb-6">
        {schoolInfo?.logo ? (
          <img src={schoolInfo.logo} alt="School Logo" className="h-16 w-16 object-contain" />
        ) : (
          <div className="h-16 w-16 flex items-center justify-center bg-slate-100 rounded"><Building2 className="h-8 w-8 text-slate-400" /></div>
        )}
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">{schoolInfo?.name || 'School'}</h1>
          {schoolInfo?.address && <p className="text-xs text-slate-600">{schoolInfo.address}</p>}
        </div>
      </div>
    );

    if (printData.kind === 'student_invoice') {
      const { parent, ledgerStudent } = printData;
      const st = ledgerStudent.student;
      const breakdown = getStudentBreakdown(ledgerStudent);
      return (
        <div className="p-10 text-slate-900 bg-white">
          <Letterhead />
          <h2 className="text-center text-lg font-black uppercase tracking-widest mb-6">Invoice Summary</h2>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p><strong>Student:</strong> {toTitleCase(st.full_name)}</p>
              <p><strong>Reg No:</strong> {st.registration_number}</p>
              <p><strong>Class:</strong> {st.current_class_name} {st.current_class_section_name || ''}</p>
            </div>
            <div className="text-right">
              <p><strong>Parent/Guardian:</strong> {toTitleCase(parent?.parent_name || ledgerStudent.student.parent_name)}</p>
              <p><strong>Session:</strong> {sessionDisplay}</p>
              <p><strong>Term:</strong> {periodDisplay}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Billed</th>
                <th className="text-right py-2">Discount</th>
                <th className="text-right py-2">Waived</th>
                <th className="text-right py-2">Paid</th>
                <th className="text-right py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.items.map((it, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2">{it.description}</td>
                  <td className="text-right py-2">{formatCurrency(it.billed)}</td>
                  <td className="text-right py-2 text-emerald-700">-{formatCurrency(it.discount)}</td>
                  <td className="text-right py-2 text-amber-700">-{formatCurrency(it.waived)}</td>
                  <td className="text-right py-2">{formatCurrency(it.paid)}</td>
                  <td className="text-right py-2 font-bold">{formatCurrency(it.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-black">
                <td className="py-2">TOTAL</td>
                <td className="text-right py-2">{formatCurrency(breakdown.billed)}</td>
                <td className="text-right py-2">-{formatCurrency(breakdown.discount)}</td>
                <td className="text-right py-2">-{formatCurrency(breakdown.waived)}</td>
                <td className="text-right py-2">{formatCurrency(breakdown.paid)}</td>
                <td className="text-right py-2 text-base">{formatCurrency(breakdown.balance)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-between items-center bg-slate-100 p-4 rounded mb-8">
            <span className="font-black uppercase text-sm">Balance Due</span>
            <span className="font-black text-xl">{formatCurrency(breakdown.balance)}</span>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-8">Printed on {printedOn} — Official Statement of Account Summary.</p>
        </div>
      );
    }

    if (printData.kind === 'family_statement') {
      const { parent } = printData;
      const pb = getParentBreakdown(parent);
      return (
        <div className="p-10 text-slate-900 bg-white">
          <Letterhead />
          <h2 className="text-center text-lg font-black uppercase tracking-widest mb-6">Family Statement of Account</h2>
          <div className="mb-6 text-sm">
            <p><strong>Parent/Guardian:</strong> {toTitleCase(parent.parent_name)}</p>
            {parent.phone && <p><strong>Phone:</strong> {parent.phone}</p>}
            <p><strong>Session:</strong> {sessionDisplay} &nbsp;&nbsp; <strong>Term:</strong> {periodDisplay}</p>
          </div>

          {pb.children.map(({ ledgerStudent, breakdown }: any) => (
            <div key={ledgerStudent.student_id || ledgerStudent.student?.id} className="mb-6">
              <h3 className="font-bold text-sm bg-slate-100 px-3 py-1.5 rounded">
                {toTitleCase(ledgerStudent.student.full_name)} — {ledgerStudent.student.current_class_name} {ledgerStudent.student.current_class_section_name || ''}
              </h3>
              <table className="w-full text-xs border-collapse mt-2">
                <tbody>
                  {breakdown.items.map((it: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5">{it.description}</td>
                      <td className="text-right py-1.5">{formatCurrency(it.billed)}</td>
                      <td className="text-right py-1.5 text-emerald-700">-{formatCurrency(it.discount)}</td>
                      <td className="text-right py-1.5 text-amber-700">-{formatCurrency(it.waived)}</td>
                      <td className="text-right py-1.5">{formatCurrency(it.paid)}</td>
                      <td className="text-right py-1.5 font-bold">{formatCurrency(it.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-xs font-bold mt-1">Subtotal: {formatCurrency(breakdown.balance)}</p>
            </div>
          ))}

          {pb.family && (
            <div className="mb-6">
              <h3 className="font-bold text-sm bg-purple-50 px-3 py-1.5 rounded">Shared Family Fees ({pb.family.invoice_number})</h3>
              <table className="w-full text-xs border-collapse mt-2">
                <tbody>
                  {pb.family.items.map((it: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5">{cleanFeeDescription(it.description)}</td>
                      <td className="text-right py-1.5">{formatCurrency(it.amount)}</td>
                      <td className="text-right py-1.5 text-emerald-700">-{formatCurrency(it.total_discount)}</td>
                      <td className="text-right py-1.5 text-amber-700">-{formatCurrency(it.total_waived)}</td>
                      <td className="text-right py-1.5">{formatCurrency(it.amount_paid)}</td>
                      <td className="text-right py-1.5 font-bold">{formatCurrency(it.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-xs font-bold mt-1">Subtotal: {formatCurrency(pb.family.balance)}</p>
            </div>
          )}

          <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded mt-8">
            <span className="font-black uppercase text-sm">Total Family Balance Due</span>
            <span className="font-black text-xl">{formatCurrency(pb.balance)}</span>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-8">Printed on {printedOn} — This statement consolidates every ward under one family account.</p>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="py-32 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const grandTotalOwed = ledgerData ? parseFloat(ledgerData.grand_total_outstanding || '0') : 0;

  const selectedSessionObj = sessions.find(s => s.id.toString() === filterSessionId);
  const selectedPeriodObj: any = periods.find(p => p.id.toString() === filterPeriodId);
  const termDisplayName = [
    selectedSessionObj ? `${selectedSessionObj.start_year}/${selectedSessionObj.end_year}` : '',
    selectedPeriodObj?.name || selectedPeriodObj?.period?.name || ''
  ].filter(Boolean).join(' ');

  const activeStudents = ledgerData?.students?.filter((ledgerStudent: any) => {
    const hasInvoice = !!ledgerStudent.invoice;
    const hasAdhoc = (ledgerStudent.other_payments || []).length > 0;
    return hasInvoice || hasAdhoc;
  }) || [];

  const hasFamilyInvoice = !!ledgerData?.family_invoice;
  const hasAnyBilling = activeStudents.length > 0 || hasFamilyInvoice;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-4 pb-20 px-4 sm:px-6 print:hidden">
        <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

        {/* ── 1. SESSION & TERM SELECTOR CARD ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-40">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Session</label>
              <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
                {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Term / Period</label>
              <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} disabled={!filterSessionId} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
                {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {ledgerData && hasAnyBilling && (
              <button
                onClick={() => printFamilyStatement(ledgerData)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                title="Print one consolidated statement covering every ward"
              >
                <Printer className="w-3.5 h-3.5" /> Print Full Statement
              </button>
            )}
            <button
              onClick={() => router.push(`/dashboard/parent/fees/history?session=${filterSessionId}&period=${filterPeriodId}`)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" /> View Payments for this Term
            </button>
            <button onClick={fetchLedger} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── 2. OUTSTANDING BALANCE HERO BANNER (Red if > 0, Green if 0) ── */}
        <div className={`relative rounded-2xl p-6 text-white shadow-lg overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors duration-300 ${
          grandTotalOwed > 0
            ? 'bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 border border-rose-500/20'
            : 'bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 border border-emerald-500/20'
        }`}>
          <div className="relative z-10">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${grandTotalOwed > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              Total Family Outstanding Balance
            </p>
            <h1 className="text-3xl font-black tracking-tight">{formatCurrency(grandTotalOwed)}</h1>
            <p className="text-[11px] text-slate-300 mt-0.5 font-medium">For {termDisplayName || 'Selected Term'}</p>
          </div>

          {grandTotalOwed > 0 && (
            <div className="relative z-10 w-full sm:w-auto">
              <button
                onClick={() => router.push(`/dashboard/parent/fees/checkout?session=${filterSessionId}&period=${filterPeriodId}`)}
                className="w-full sm:w-auto px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Make Payment <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── 3. LEDGER BREAKDOWN LIST ── */}
        <div className="space-y-3">
          {dataLoading && !ledgerData ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : !hasAnyBilling ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 space-y-1">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-sm text-slate-700">No invoices found for {termDisplayName || 'this term'}.</p>
              <p className="text-xs text-slate-400">There are no active bills generated for your wards during this academic period.</p>
            </div>
          ) : (
            <>
              {/* Students Loop */}
              {activeStudents.map((ledgerStudent: any) => {
                const st = ledgerStudent.student || {};
                const studentName = toTitleCase(st.full_name || ledgerStudent.__str__ || 'Student');
                const invoice = ledgerStudent.invoice;
                const adhoc = ledgerStudent.other_payments || [];

                return (
                  <div key={st.id || ledgerStudent.student_id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-3">
                        {st.image_url ? (
                          <img src={st.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {studentName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-black text-slate-800 text-sm">{studentName}</h3>
                          <p className="text-[11px] font-semibold text-slate-400">
                            {st.registration_number} {st.current_class_name ? `• ${st.current_class_name} ${st.current_class_section_name || ''}` : ''}
                          </p>
                        </div>
                      </div>
                      {invoice && (
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                          {renderStatusBadge(invoice.balance, invoice.amount_paid)}
                          <button
                            onClick={() => setInvoiceDrawer({ type: 'student', parent: { parent_name: ledgerData.parent_name }, ledgerStudent })}
                            className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
                            title="View 100% Exact Invoice Breakdown"
                          >
                            <Eye className="w-4 h-4 text-indigo-600" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-3">
                      {invoice?.items?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Termly Fee Structure</p>
                          <div className="divide-y divide-slate-100">
                            {invoice.items.map((it: any) => {
                              const discountVal = parseFloat(it.total_discount || '0');
                              const waivedVal = parseFloat(it.total_waived || '0');
                              return (
                                <div key={it.id} className="py-2.5 flex justify-between items-center text-xs">
                                  <div>
                                    <p className="font-bold text-slate-800">{cleanFeeDescription(it.description)}</p>
                                    <p className="text-[11px] text-slate-400">
                                      Billed: {formatCurrency(it.amount)}
                                      {discountVal > 0 && <span className="text-emerald-600 ml-1.5 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Discount: -{formatCurrency(discountVal)}</span>}
                                      {waivedVal > 0 && <span className="text-amber-600 ml-1.5 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Waived: -{formatCurrency(waivedVal)}</span>}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className={`font-black ${balanceColorClass(it.balance)}`}>{formatCurrency(it.balance)}</p>
                                    <p className="text-[10px] font-semibold text-slate-400">Paid: {formatCurrency(it.amount_paid)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {adhoc.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Incidental Charges & Fines</p>
                          <div className="divide-y divide-amber-50">
                            {adhoc.map((op: any) => (
                              <div key={op.id} className="py-2.5 flex justify-between items-center text-xs bg-amber-50/20 px-2.5 rounded-xl">
                                <div>
                                  <p className="font-bold text-amber-900">{cleanFeeDescription(op.description)} <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold uppercase">{op.category_display}</span></p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-black ${balanceColorClass(op.balance)}`}>{formatCurrency(op.balance)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Family Shared Fees Section */}
              {hasFamilyInvoice && (
                <div className="bg-purple-50/40 rounded-2xl border border-purple-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-purple-100/50 border-b border-purple-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center font-bold shrink-0">
                        <ShieldMinus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-purple-900 text-sm">Family Shared Fees</h3>
                        <p className="text-[11px] font-semibold text-purple-600">{ledgerData.family_invoice.invoice_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                      {renderStatusBadge(ledgerData.family_invoice.balance, ledgerData.family_invoice.amount_paid)}
                      <button
                        onClick={() => setInvoiceDrawer({ type: 'family', parent: ledgerData })}
                        className="p-1.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors shadow-2xs"
                        title="View Family Drawer"
                      >
                        <Eye className="w-4 h-4 text-purple-600" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 divide-y divide-purple-100">
                    {ledgerData.family_invoice.items?.map((it: any) => {
                      const discountVal = parseFloat(it.total_discount || '0');
                      const waivedVal = parseFloat(it.total_waived || '0');
                      return (
                        <div key={it.id} className="py-2.5 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{cleanFeeDescription(it.description)}</p>
                            <p className="text-[11px] text-slate-400">
                              Billed: {formatCurrency(it.amount)}
                              {discountVal > 0 && <span className="text-emerald-600 ml-1.5 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Discount: -{formatCurrency(discountVal)}</span>}
                              {waivedVal > 0 && <span className="text-amber-600 ml-1.5 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-emerald-100">Waived: -{formatCurrency(waivedVal)}</span>}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-black ${balanceColorClass(it.balance)}`}>{formatCurrency(it.balance)}</p>
                            <p className="text-[10px] font-semibold text-slate-400">Paid: {formatCurrency(it.amount_paid)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 4. 100% EXACT INVOICE-PAGE PARITY DRAWER ── */}
        {invoiceDrawer && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in slide-in-from-right-8" onClick={() => setInvoiceDrawer(null)}>
            <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

              {/* Header matching exact staff invoice view */}
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-black text-slate-800 text-lg flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-500"/>
                  {invoiceDrawer.type === 'family' ? 'Family Invoice Details' : 'Student Invoice Details'}
                </h3>
                <button type="button" onClick={() => setInvoiceDrawer(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-md shadow-sm border border-slate-200" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              {/* Scrollable Body matching exact Invoice page drawer contents */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {invoiceDrawer.type === 'student' ? (() => {
                  const { ledgerStudent, parent } = invoiceDrawer;
                  const st = ledgerStudent.student;
                  const breakdown = getStudentBreakdown(ledgerStudent);
                  return (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          {st.image_url ? (
                            <img src={st.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg shrink-0">
                              {toTitleCase(st.full_name).charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student</p>
                            <p className="text-lg font-bold text-slate-800">{toTitleCase(st.full_name)}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{st.current_class_name} {st.current_class_section_name ? `(${st.current_class_section_name})` : ''}</p>
                          </div>
                        </div>
                        {ledgerStudent.invoice && (
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                            {renderStatusBadge(ledgerStudent.invoice.balance, ledgerStudent.invoice.amount_paid)}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Billing Breakdown</p>
                        </div>
                        <ul className="divide-y divide-slate-100">
                          {breakdown.items.length === 0 ? (
                            <li className="p-6 text-center text-sm font-medium text-slate-400">No billed items found.</li>
                          ) : breakdown.items.map((it, i) => (
                            <li key={i} className="p-4 hover:bg-white transition-colors">
                              <div className="flex justify-between items-start mb-1.5">
                                <p className="text-sm font-bold text-slate-800 pr-2">{it.description}</p>
                                <p className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(it.billed)}</p>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold">
                                {it.discount > 0 && <span className="text-emerald-600">Discount -{formatCurrency(it.discount)}</span>}
                                {it.waived > 0 && <span className="text-amber-600">Waived -{formatCurrency(it.waived)}</span>}
                                <span className="text-slate-500">Paid {formatCurrency(it.paid)}</span>
                                <span className={balanceColorClass(it.balance)}>Balance {formatCurrency(it.balance)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Billed</span><span>{formatCurrency(breakdown.billed)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-emerald-400"><span>Total Discount</span><span>-{formatCurrency(breakdown.discount)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-amber-400"><span>Total Waived</span><span>-{formatCurrency(breakdown.waived)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Paid</span><span>{formatCurrency(breakdown.paid)}</span></div>
                        <div className="h-px bg-white/10 my-1"></div>
                        <div className="flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest">Balance Due</span><span className="text-lg font-black">{formatCurrency(breakdown.balance)}</span></div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => printStudentInvoice(parent, ledgerStudent)}
                          className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-1.5">
                          <Printer className="w-3.5 h-3.5" /> Print Invoice Summary
                        </button>
                      </div>
                    </>
                  );
                })() : (() => {
                  const fi = invoiceDrawer.parent.family_invoice;
                  return (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parent / Guardian</p>
                          <p className="text-lg font-bold text-slate-800">{toTitleCase(invoiceDrawer.parent.parent_name)}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{fi.invoice_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                          {renderStatusBadge(fi.balance, fi.amount_paid)}
                        </div>
                      </div>

                      <div className="bg-purple-50 rounded-xl border border-purple-100 overflow-hidden">
                        <div className="px-4 py-2 bg-purple-100 border-b border-purple-200">
                          <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Shared Family Charges</p>
                        </div>
                        <ul className="divide-y divide-purple-100">
                          {(!fi.items || fi.items.length === 0) ? (
                            <li className="p-6 text-center text-sm font-medium text-slate-400">No billed items found.</li>
                          ) : fi.items.map((item: any) => (
                            <li key={item.id} className="p-4 hover:bg-white transition-colors">
                              <div className="flex justify-between items-start mb-1.5">
                                <p className="text-sm font-bold text-slate-800 pr-2">{cleanFeeDescription(item.description)}</p>
                                <p className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(item.amount)}</p>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold">
                                {parseFloat(item.total_discount || '0') > 0 && <span className="text-emerald-600">Discount -{formatCurrency(item.total_discount)}</span>}
                                {parseFloat(item.total_waived || '0') > 0 && <span className="text-amber-600">Waived -{formatCurrency(item.total_waived)}</span>}
                                <span className="text-slate-500">Paid {formatCurrency(item.amount_paid)}</span>
                                <span className={balanceColorClass(item.balance)}>Balance {formatCurrency(item.balance)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Billed</span><span>{formatCurrency(fi.total_amount)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-emerald-400"><span>Total Discount</span><span>-{formatCurrency(fi.total_discount)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-amber-400"><span>Total Waived</span><span>-{formatCurrency(fi.total_waived)}</span></div>
                        <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Paid</span><span>{formatCurrency(fi.amount_paid)}</span></div>
                        <div className="h-px bg-white/10 my-1"></div>
                        <div className="flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest">Balance Due</span><span className="text-lg font-black">{formatCurrency(fi.balance)}</span></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Print-only stylesheet ── */}
      <style>{`
        @media print {
          @page { margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Print Root — this was missing entirely before, which is why printing
           produced a blank page: renderPrintContent() was defined but never
           actually mounted anywhere in the tree. It has to live OUTSIDE the
           print:hidden wrapper above, and only reveal itself during print via
           `hidden print:block`. ── */}
      {printData && (
        <div className="hidden print:block" id="print-area">
          {renderPrintContent()}
        </div>
      )}
    </>
  );
}

export default function ParentBillingPage() {
  return (
    <Suspense fallback={<div className="py-32 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
      <ParentBillingContent />
    </Suspense>
  );
}