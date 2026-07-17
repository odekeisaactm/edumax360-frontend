'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { feeAPI, academicCalendarAPI, schoolInfoAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod } from '@/lib/types';
import {
  Search, AlertCircle, Check, X, Loader2, Users, FileText, PlusCircle, ShieldMinus,
  RefreshCw, MoreVertical, Mail, Printer, Info, User, Wallet, Eye, ExternalLink, SearchIcon,
  AlertTriangle, Building2
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const renderStatusBadge = (balanceStr: string, paidStr: string) => {
  const balance = parseFloat(balanceStr || '0');
  const paid = parseFloat(paidStr || '0');
  if (balance <= 0) return <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">Paid</span>;
  if (paid > 0) return <span className="px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap">Partial</span>;
  return <span className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap">Not Paid</span>;
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  fine: 'Disciplinary charges — late fees, rule violations, or other penalties.',
  damage: 'Cost recovery for damaged or lost school property (books, equipment, furniture, etc.).',
  historical: 'Legacy or carried-over debt from a previous term or system.',
  other: 'Any one-off charge that doesn\u2019t fit the categories above.',
};

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0" aria-label="Dismiss notification"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Ledger Component ─────────────────────────────────────────────────────
function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const urlSession = searchParams.get('session');
  const urlPeriod = searchParams.get('period');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  // ── Core State ──
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [filterSessionId, setFilterSessionId] = useState<string>(urlSession || '');
  const [filterPeriodId, setFilterPeriodId] = useState<string>(urlPeriod || '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'parent' | 'student'>('parent');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rawLedgers, setRawLedgers] = useState<any[]>([]);

  // ── Selection State ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // ── Modals / Drawers State ──
  const [adHocModalOpen, setAdHocModalOpen] = useState(false);
  const [chargeCategory, setChargeCategory] = useState('fine');
  const [studentDetailModal, setStudentDetailModal] = useState<any | null>(null);
  // invoiceDrawer replaces the old "quick view" modal — this is the drawer that carries
  // the full discount/waived/paid/balance breakdown that was removed from the table.
  const [invoiceDrawer, setInvoiceDrawer] = useState<{ type: 'student'; parent: any; ledgerStudent: any } | { type: 'family'; parent: any } | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<{ actionType: 'send_reminders' | 'send_summaries'; scope: 'all' | 'selected'; count: number } | null>(null);

  // ── Print State ──
  // Browser-native print (not a generated PDF file) so a cashier standing at a plugged-in
  // printer can print instantly — and "Save as PDF" is still available as a destination
  // inside the browser's own print dialog for anyone who wants a file instead.
  const [printData, setPrintData] = useState<{ kind: 'student_invoice'; parent: any; ledgerStudent: any } | { kind: 'family_statement'; parent: any } | null>(null);

  // ── Autocomplete State for Ad-Hoc Charge Modal ──
  const [chargeSearchQuery, setChargeSearchQuery] = useState('');
  const [chargeSearchResults, setChargeSearchResults] = useState<any[]>([]);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [selectedChargeStudent, setSelectedChargeStudent] = useState<any | null>(null);

  // ── Initialize Filters ──
  useEffect(() => {
    const init = async () => {
      try {
        const [sessData, curSessRaw] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession()
        ]);
        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        setSessions(Array.isArray(sessData) ? sessData : []);
        const targetSessionId = urlSession || (curSess?.id ? curSess.id.toString() : null);

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
        showToast('error', 'Failed to initialize calendar data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [urlSession, urlPeriod]);

  // ── Load School Branding (for print letterhead) — best-effort, never blocks the page ──
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
        mode: 'parent',
        page: currentPage,
        q: searchQuery
      });
      setRawLedgers(res.results || []);
      setTotalPages(Math.ceil((res.count || 0) / 50) || 1);
      setSelectedIds(new Set());
    } catch (error: any) {
      showToast('error', extractError(error));
    } finally {
      setDataLoading(false);
    }
  }, [filterSessionId, filterPeriodId, currentPage, searchQuery]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchLedger(); }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchLedger, filterStatus, viewMode]);

  // ── Compute Flattened/Filtered View Data ──
  const displayData = useMemo(() => {
    let data = rawLedgers;
    data = data.filter(p => {
      const hasTuition = p.students.some((s: any) => s.invoice);
      const hasAdHoc = p.students.some((s: any) => s.other_payments?.length > 0);
      return hasTuition || hasAdHoc || p.family_invoice;
    });

    if (filterStatus) {
      data = data.filter(parent => {
        if (filterStatus === 'paid') return parseFloat(parent.grand_total_outstanding) <= 0;
        if (filterStatus === 'unpaid') return parseFloat(parent.grand_total_outstanding) > 0;
        return true;
      });
    }
    return data;
  }, [rawLedgers, filterStatus]);

  const allStudentsInLedger = useMemo(() => {
    return displayData.flatMap(p => p.students);
  }, [displayData]);

  // ── Combined Billing Breakdown Helpers ──
  // A student's true financial picture spans two sources: the structured tuition
  // invoice AND any ad-hoc charges. This combines both into one itemized list plus
  // aggregate totals — used by the invoice drawer, the print summary, and the page
  // totals footer, so all three always agree with each other.
  const getStudentBreakdown = useCallback((ledgerStudent: any) => {
    const items: { description: string; billed: number; discount: number; waived: number; paid: number; balance: number }[] = [];
    let billed = 0, discount = 0, waived = 0, paid = 0, balance = 0;

    if (ledgerStudent.invoice) {
      ledgerStudent.invoice.items?.forEach((it: any) => {
        items.push({
          description: it.description,
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
        description: `${op.description} (${op.category_display})`,
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

  const getParentBreakdown = useCallback((parent: any) => {
    const children = parent.students.map((ls: any) => ({ ledgerStudent: ls, breakdown: getStudentBreakdown(ls) }));
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

  // ── Page Totals Footer ──
  const pageTotals = useMemo(() => {
    let billed = 0, discount = 0, waived = 0, paid = 0, balance = 0;
    displayData.forEach(parent => {
      parent.students.forEach((ls: any) => {
        const b = getStudentBreakdown(ls);
        billed += b.billed; discount += b.discount; waived += b.waived; paid += b.paid; balance += b.balance;
      });
      if (viewMode === 'parent' && parent.family_invoice) {
        billed += parseFloat(parent.family_invoice.total_amount);
        discount += parseFloat(parent.family_invoice.total_discount);
        waived += parseFloat(parent.family_invoice.total_waived);
        paid += parseFloat(parent.family_invoice.amount_paid);
        balance += parseFloat(parent.family_invoice.balance);
      }
    });
    return { billed, discount, waived, paid, balance };
  }, [displayData, viewMode, getStudentBreakdown]);

  // ── Student Autocomplete Search (Hits Backend) ──
  useEffect(() => {
    if (chargeSearchQuery.length < 2) {
      setChargeSearchResults([]);
      return;
    }
    const delayFn = setTimeout(async () => {
      setIsSearchingStudent(true);
      try {
        // Fallback: If your API is strictly /api/students/, we query it.
        // We gracefully catch errors and fall back to local ledger students if needed.
        const res = await api.get('/api/student_management/students/', { params: { search: chargeSearchQuery, limit: 10 } });
        setChargeSearchResults(res.data.results || res.data || []);
      } catch (e) {
        // Fallback local search if endpoint is unavailable
        const localHits = allStudentsInLedger.filter(s =>
          s.student.full_name.toLowerCase().includes(chargeSearchQuery.toLowerCase()) ||
          s.student.registration_number.toLowerCase().includes(chargeSearchQuery.toLowerCase())
        ).map(s => s.student);
        setChargeSearchResults(localHits);
      } finally {
        setIsSearchingStudent(false);
      }
    }, 400);
    return () => clearTimeout(delayFn);
  }, [chargeSearchQuery, allStudentsInLedger]);

  // ── Selection Logic ──
  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === displayData.length && viewMode === 'parent') {
      setSelectedIds(new Set());
    } else {
      if (viewMode === 'parent') setSelectedIds(new Set(displayData.map(p => p.parent_id)));
      if (viewMode === 'student') setSelectedIds(new Set(allStudentsInLedger.map(s => s.student_id)));
    }
  };

  // ── Bulk Actions — now routed through a confirmation step, with explicit counts in labels ──
  const openBulkConfirm = (actionType: 'send_reminders' | 'send_summaries', scope: 'all' | 'selected') => {
    setIsActionMenuOpen(false);
    const count = scope === 'selected' ? selectedIds.size : (viewMode === 'parent' ? displayData.length : allStudentsInLedger.length);
    if (count === 0) return showToast('error', 'No targets to send to.');
    setBulkConfirm({ actionType, scope, count });
  };

  const handleBulkAction = async (actionType: 'send_reminders' | 'send_summaries', scope: 'all' | 'selected') => {
    setBulkConfirm(null);
    let targetIds: number[] = [];
    if (scope === 'selected') {
      targetIds = Array.from(selectedIds);
    } else {
      targetIds = viewMode === 'parent' ? displayData.map(p => p.parent_id) : allStudentsInLedger.map(s => s.student_id);
    }

    if (targetIds.length === 0) return showToast('error', 'No targets selected.');
    setDataLoading(true);
    try {
      await api.post('/api/fee/ledger/', {
        action: actionType,
        target_type: viewMode === 'student' ? 'student' : 'parent',
        target_ids: targetIds,
        session_id: Number(filterSessionId),
        period_id: Number(filterPeriodId)
      });
      showToast('success', `Bulk action '${actionType}' initiated for ${targetIds.length} records.`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setDataLoading(false);
    }
  };

  const closeAdHocModal = () => {
    setAdHocModalOpen(false);
    setSelectedChargeStudent(null);
    setChargeSearchQuery('');
    setChargeSearchResults([]);
    setChargeCategory('fine');
  };

  const handleCreateAdHoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedChargeStudent) return showToast('error', 'Please search and select a student first.');
    const fd = new FormData(e.currentTarget);
    try {
      await feeAPI.createOtherPayment({
        student: selectedChargeStudent.id,
        session: Number(fd.get('session_id')),
        period: Number(fd.get('period_id')),
        category: fd.get('category') as any,
        description: fd.get('description') as string,
        amount: fd.get('amount') as string,
      });
      showToast('success', 'Charge added successfully.');
      closeAdHocModal();
      fetchLedger();
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  // ── Print Triggers ──
  const printStudentInvoice = (parent: any, ledgerStudent: any) => {
    setInvoiceDrawer(null);
    setPrintData({ kind: 'student_invoice', parent, ledgerStudent });
  };
  const printFamilyStatement = (parent: any) => {
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

  // ── Print Content ──
  const renderPrintContent = () => {
    if (!printData) return null;
    const sessionObj = sessions.find(s => s.id.toString() === filterSessionId);
    const periodObj: any = periods.find((p: any) => p.id.toString() === filterPeriodId);
    const periodDisplay = periodObj?.name || periodObj?.period?.name || '';
    const sessionDisplay = sessionObj ? `${sessionObj.start_year}/${sessionObj.end_year}` : '';
    const printedOn = new Date().toLocaleString('en-GB');
    const staffName = `${(user as any)?.first_name || ''} ${(user as any)?.last_name || ''}`.trim() || 'Finance Office';

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
          <p className="text-xs text-slate-600">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join('  |  ')}</p>
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
              <p><strong>Parent/Guardian:</strong> {toTitleCase(parent.parent_name)}</p>
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

          <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Issued By: {staffName}</div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Signature &amp; Stamp</div></div>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-8">Printed on {printedOn} — This is a summary of billed charges, not a payment receipt.</p>
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
            <div key={ledgerStudent.student_id} className="mb-6">
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
                      <td className="py-1.5">{it.description}</td>
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

          <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Issued By: {staffName}</div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Signature &amp; Stamp</div></div>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-8">Printed on {printedOn} — This statement consolidates every ward under one family account.</p>
        </div>
      );
    }

    return null;
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <>
      <div className="space-y-6 pb-20 w-full animate-in fade-in duration-300 relative print:hidden">
        <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

        {/* ── Title & Actions Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Statement of Accounts</h1>
            <p className="text-sm text-slate-500 mt-1">Comprehensive billing ledger, statements, and bulk communications.</p>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <button onClick={() => { setChargeCategory('fine'); setAdHocModalOpen(true); }}
                title="Add a one-off fine, damage fee, or other incidental charge to a student's account"
                className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-bold rounded border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Add Charge
              </button>
            )}

            {canManage && (
              <div className="relative">
                <button onClick={() => setIsActionMenuOpen(!isActionMenuOpen)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 shadow flex items-center gap-2">
                  Bulk Actions <MoreVertical className="w-4 h-4" />
                </button>

                {isActionMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsActionMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <button onClick={() => router.push('/dashboard/staff/fee/generation-jobs')} className="w-full text-left px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded flex items-center">
                          <FileText className="w-4 h-4 mr-2 text-indigo-500"/> Generate New Invoices
                        </button>
                      </div>
                      <div className="p-2 border-b border-slate-100">
                        <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email/WhatsApp Reminders</p>
                        <button onClick={() => openBulkConfirm('send_reminders', 'all')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center">
                          <Mail className="w-4 h-4 mr-2 text-blue-500"/> Send to All ({viewMode === 'parent' ? displayData.length : allStudentsInLedger.length})
                        </button>
                        <button disabled={selectedIds.size === 0} onClick={() => openBulkConfirm('send_reminders', 'selected')} className="w-full text-left px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-transparent rounded flex items-center">
                          <Check className="w-4 h-4 mr-2"/> Send to Selected ({selectedIds.size})
                        </button>
                      </div>
                      <div className="p-2">
                        <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statements &amp; Receipts</p>
                        <button onClick={() => openBulkConfirm('send_summaries', 'all')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center">
                          <Printer className="w-4 h-4 mr-2 text-indigo-500"/> Send to All ({viewMode === 'parent' ? displayData.length : allStudentsInLedger.length})
                        </button>
                        <button disabled={selectedIds.size === 0} onClick={() => openBulkConfirm('send_summaries', 'selected')} className="w-full text-left px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:hover:bg-transparent rounded flex items-center">
                          <Check className="w-4 h-4 mr-2"/> Send to Selected ({selectedIds.size})
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Auto-Updating Filter Bar ── */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Search Parent/Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}}
                       className="w-full pl-9 pr-4 py-2 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white" placeholder="Search..." />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Session</label>
              <select value={filterSessionId} onChange={e => {setFilterSessionId(e.target.value); setCurrentPage(1);}} className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white">
                {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Term / Quarter</label>
              <select value={filterPeriodId} onChange={e => {setFilterPeriodId(e.target.value); setCurrentPage(1);}} disabled={!filterSessionId} className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white disabled:bg-slate-100">
                {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Group By</label>
              <select value={viewMode} onChange={e => {setViewMode(e.target.value as any); setCurrentPage(1); setSelectedIds(new Set());}} className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white">
                <option value="parent">By Parent</option>
                <option value="student">By Student</option>
              </select>
            </div>

            <div className="md:col-span-1 flex items-center justify-between">
              <div className="w-full mr-2">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Status</label>
                <select value={filterStatus} onChange={e => {setFilterStatus(e.target.value); setCurrentPage(1);}} className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white">
                  <option value="">All Active</option>
                  <option value="paid">Fully Paid</option>
                  <option value="unpaid">Outstanding</option>
                </select>
              </div>
              <button onClick={fetchLedger} className="mt-5 p-2 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 transition-colors" title="Force Refresh" aria-label="Refresh ledger data">
                <RefreshCw className={`w-5 h-5 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Ledger Table ── */}
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          {/* Selection bar — only appears once something is checked, sits above the sticky header */}
          {selectedIds.size > 0 && (
            <div className="sticky top-0 z-30 h-10 bg-indigo-600 text-white px-4 flex items-center justify-between shadow-md">
              <span className="text-xs sm:text-sm font-bold">{selectedIds.size} {viewMode === 'parent' ? 'parent' : 'student'}{selectedIds.size > 1 ? 's' : ''} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={() => openBulkConfirm('send_reminders', 'selected')} className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md text-[11px] font-bold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5"/> Send Reminders
                </button>
                <button onClick={() => openBulkConfirm('send_summaries', 'selected')} className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md text-[11px] font-bold flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5"/> Send Statements
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-white/20 rounded-md" aria-label="Clear selection"><X className="h-3.5 w-3.5"/></button>
              </div>
            </div>
          )}

          {dataLoading && displayData.length === 0 ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : displayData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText className="h-10 w-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No active ledger records match the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className={`bg-slate-50 border-b-2 border-slate-200 sticky z-20 ${selectedIds.size > 0 ? 'top-10' : 'top-0'}`}>
                    <tr>
                       <th className="w-10 px-4 py-3 text-center"><input type="checkbox" onChange={toggleAll} checked={selectedIds.size > 0 && selectedIds.size === (viewMode === 'parent' ? displayData.length : allStudentsInLedger.length)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" aria-label="Select all rows"/></th>
                       <th className="px-4 py-3 font-bold text-slate-700 bg-slate-50">Name / Reference</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-right bg-slate-50" title="Amount originally billed before any reductions">Total Billed</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-right bg-slate-50" title="Automatic, rule-based reduction (e.g. a sibling or staff discount policy)">Discount</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-right bg-slate-50" title="Manual reduction applied by staff on a case-by-case basis">Waived</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-right bg-slate-50" title="Total amount received so far">Paid</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-right bg-slate-50" title="Outstanding amount still owed">Balance Due</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-center bg-slate-50">Status</th>
                       <th className="px-4 py-3 font-bold text-slate-700 text-center bg-slate-50">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {displayData.map((parent) => {
                      const grandTotal = parseFloat(parent.grand_total_outstanding);

                      // ==========================================
                      // PARENT VIEW RENDERING
                      // ==========================================
                      if (viewMode === 'parent') {
                        return (
                          <React.Fragment key={`parent-${parent.parent_id}`}>
                            {/* PARENT HEADER ROW */}
                            <tr className="bg-[#e9ecef] border-t border-slate-300 hover:bg-slate-200 transition-colors">
                               <td className="px-4 py-3 text-center">
                                 <input type="checkbox" checked={selectedIds.has(parent.parent_id)} onChange={() => toggleSelection(parent.parent_id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4" aria-label={`Select ${toTitleCase(parent.parent_name)}`}/>
                               </td>
                               <td colSpan={5} className="px-4 py-3">
                                 <div className="flex items-center gap-2">
                                   <Users className="h-4 w-4 text-slate-700" />
                                   <span className="font-black text-slate-800 text-[13px] uppercase tracking-wide">{toTitleCase(parent.parent_name)}</span>
                                   <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold rounded shadow-sm">{parent.students.length} Ward(s)</span>
                                   <span className="text-[11px] text-slate-500 font-bold ml-1">PAR-{parent.parent_id.toString().padStart(4, '0')}</span>
                                 </div>
                               </td>
                               <td className="px-4 py-3 text-right">
                                 <span className={`text-[15px] font-black ${grandTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                   {formatCurrency(grandTotal)}
                                 </span>
                               </td>
                               <td colSpan={2} className="px-4 py-3">
                                 <div className="flex items-center justify-center gap-2">
                                   <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?parent_id=${parent.parent_id}`)} className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded shadow-sm hover:bg-slate-700 flex items-center" title="Record a payment against this family's balance">
                                     <Wallet className="w-3.5 h-3.5 mr-1.5"/> Receive Payment
                                   </button>
                                   <button onClick={() => printFamilyStatement(parent)} className="p-2 bg-white border border-slate-300 text-slate-600 rounded shadow-sm hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="Print consolidated statement (all wards)" aria-label={`Print family statement for ${toTitleCase(parent.parent_name)}`}>
                                     <Printer className="w-3.5 h-3.5"/>
                                   </button>
                                 </div>
                               </td>
                            </tr>

                            {/* STUDENTS */}
                            {parent.students.map((ledgerStudent: any) => {
                              const st = ledgerStudent.student; // From StudentListSerializer
                              const tuitionBal = ledgerStudent.invoice ? parseFloat(ledgerStudent.invoice.balance) : 0;
                              const adHocBal = ledgerStudent.other_payments?.reduce((acc: number, op: any) => acc + parseFloat(op.balance), 0) || 0;
                              const studentGrandTotal = tuitionBal + adHocBal;
                              const studentDisplayName = toTitleCase(st.full_name);

                              return (
                              <React.Fragment key={`stu-${st.id}`}>
                                {/* TUITION INVOICE */}
                                {ledgerStudent.invoice && (
                                  <tr className="hover:bg-slate-50">
                                    <td></td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {st.image_url ? (
                                          <img src={st.image_url} alt={studentDisplayName} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0"><User className="w-3.5 h-3.5"/></div>
                                        )}
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{studentDisplayName}</span>
                                            <button onClick={() => setStudentDetailModal(ledgerStudent)} className="text-slate-400 hover:text-indigo-600" title="View student profile" aria-label={`View profile for ${studentDisplayName}`}><Info className="w-3.5 h-3.5"/></button>
                                          </div>
                                          <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${ledgerStudent.invoice.id}?type=student`)} className="text-[10px] font-bold text-indigo-600 hover:underline tracking-wider text-left w-max">
                                            {ledgerStudent.invoice.invoice_number}
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(ledgerStudent.invoice.total_amount)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600">-{formatCurrency(ledgerStudent.invoice.total_discount)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-amber-600">-{formatCurrency(ledgerStudent.invoice.total_waived)}</td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(ledgerStudent.invoice.amount_paid)}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className={`font-black ${parseFloat(ledgerStudent.invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {formatCurrency(ledgerStudent.invoice.balance)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {renderStatusBadge(ledgerStudent.invoice.balance, ledgerStudent.invoice.amount_paid)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                       <div className="flex items-center justify-center gap-2 text-slate-400">
                                         <button onClick={() => setInvoiceDrawer({ type: 'student', parent, ledgerStudent })} className="hover:text-indigo-600 transition-colors" title="View full billing breakdown" aria-label={`View invoice details for ${studentDisplayName}`}><Eye className="w-4 h-4"/></button>
                                         <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${st.id}`)} className="hover:text-emerald-600 transition-colors" title="Record a payment for this student" aria-label={`Receive payment for ${studentDisplayName}`}><Wallet className="w-4 h-4"/></button>
                                       </div>
                                    </td>
                                  </tr>
                                )}

                                {/* AD-HOC CHARGES */}
                                {ledgerStudent.other_payments?.map((op: any) => (
                                  <tr key={`op-${op.id}`} className="bg-amber-50/20 hover:bg-amber-50/60 transition-colors">
                                    <td></td>
                                    <td className="px-4 py-2 pl-12">
                                      <div className="flex items-center text-amber-900/80">
                                         <span className="text-amber-300 mr-2">↳</span>
                                         <div className="flex flex-col">
                                           <span className="text-xs font-bold">{op.description}</span>
                                           <span className="text-[9px] font-bold text-amber-600/60 uppercase">{op.category_display}</span>
                                         </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{formatCurrency(op.amount)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-slate-300">-</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-amber-600">-{formatCurrency(op.total_waived || 0)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{formatCurrency(op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-xs font-black ${parseFloat(op.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(op.balance)}</span>
                                    </td>
                                    <td className="px-4 py-2 text-center">{renderStatusBadge(op.balance, op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-center">
                                      <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${st.id}`)} className="text-slate-400 hover:text-emerald-600 transition-colors mx-auto block" title="Record a payment for this charge" aria-label={`Receive payment for ${op.description}`}><Wallet className="w-3.5 h-3.5"/></button>
                                    </td>
                                  </tr>
                                ))}

                                {/* STUDENT SUBTOTAL */}
                                {ledgerStudent.other_payments?.length > 0 && ledgerStudent.invoice && (
                                  <tr className="bg-slate-50/50">
                                    <td colSpan={6} className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {studentDisplayName} Subtotal:
                                    </td>
                                    <td className="px-4 py-2 text-right text-sm font-black text-slate-700 border-t border-slate-200">
                                      {formatCurrency(studentGrandTotal)}
                                    </td>
                                    <td colSpan={2}></td>
                                  </tr>
                                )}
                              </React.Fragment>
                              );
                            })}

                            {/* FAMILY INVOICE ROW */}
                            {parent.family_invoice && (
                              <tr className="bg-purple-50/20 hover:bg-purple-50/50 transition-colors border-t border-purple-100">
                                <td></td>
                                <td className="px-4 py-3">
                                   <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><ShieldMinus className="w-4 h-4"/></div>
                                     <div className="flex flex-col">
                                       <span className="font-bold text-purple-900">Family Shared Fees</span>
                                       <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${parent.family_invoice?.id}?type=family`)} className="text-[10px] font-bold text-purple-500 hover:underline text-left w-max">
                                         {parent.family_invoice.invoice_number}
                                       </button>
                                     </div>
                                   </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-purple-700">{formatCurrency(parent.family_invoice.total_amount)}</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-600">-{formatCurrency(parent.family_invoice.total_discount)}</td>
                                <td className="px-4 py-3 text-right font-bold text-amber-600">-{formatCurrency(parent.family_invoice.total_waived)}</td>
                                <td className="px-4 py-3 text-right font-medium text-purple-700">{formatCurrency(parent.family_invoice.amount_paid)}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`font-black ${parseFloat(parent.family_invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(parent.family_invoice.balance)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                   {renderStatusBadge(parent.family_invoice.balance, parent.family_invoice.amount_paid)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2 text-purple-300">
                                     <button onClick={() => setInvoiceDrawer({ type: 'family', parent })} className="hover:text-purple-600 transition-colors" title="View full billing breakdown" aria-label={`View shared family invoice details for ${toTitleCase(parent.parent_name)}`}><Eye className="w-4 h-4"/></button>
                                     <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?parent_id=${parent.parent_id}`)} className="hover:text-emerald-600 transition-colors" title="Record a payment for this shared charge" aria-label={`Receive payment for family shared fees, ${toTitleCase(parent.parent_name)}`}><Wallet className="w-4 h-4"/></button>
                                   </div>
                                </td>
                              </tr>
                            )}
                            <tr className="border-0 bg-transparent"><td colSpan={9} className="h-4"></td></tr>
                          </React.Fragment>
                        );
                      }

                      // ==========================================
                      // STUDENT VIEW RENDERING (Flattened)
                      // ==========================================
                      if (viewMode === 'student') {
                        return parent.students.map((ledgerStudent: any) => {
                          const st = ledgerStudent.student;
                          const studentDisplayName = toTitleCase(st.full_name);
                          return (
                            <React.Fragment key={`flat-stu-${st.id}`}>
                              {ledgerStudent.invoice && (
                                <tr className="hover:bg-slate-50 border-b border-slate-100">
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={selectedIds.has(st.id)} onChange={() => toggleSelection(st.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4" aria-label={`Select ${studentDisplayName}`}/>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      {st.image_url ? (
                                        <img src={st.image_url} alt={studentDisplayName} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0"><User className="w-4 h-4"/></div>
                                      )}
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <span className="font-black text-slate-800">{studentDisplayName}</span>
                                          <button onClick={() => setStudentDetailModal(ledgerStudent)} className="text-slate-400 hover:text-indigo-600" title="View student profile" aria-label={`View profile for ${studentDisplayName}`}><Info className="w-3.5 h-3.5"/></button>
                                        </div>
                                        <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${ledgerStudent.invoice.id}?type=student`)} className="text-[10px] font-bold text-indigo-600 hover:underline tracking-wider text-left w-max">
                                          {ledgerStudent.invoice.invoice_number}
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(ledgerStudent.invoice.total_amount)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-emerald-600">-{formatCurrency(ledgerStudent.invoice.total_discount)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-amber-600">-{formatCurrency(ledgerStudent.invoice.total_waived)}</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(ledgerStudent.invoice.amount_paid)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`font-black ${parseFloat(ledgerStudent.invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {formatCurrency(ledgerStudent.invoice.balance)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {renderStatusBadge(ledgerStudent.invoice.balance, ledgerStudent.invoice.amount_paid)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                     <div className="flex items-center justify-center gap-2 text-slate-400">
                                         <button onClick={() => setInvoiceDrawer({ type: 'student', parent, ledgerStudent })} className="hover:text-indigo-600 transition-colors" title="View full billing breakdown" aria-label={`View invoice details for ${studentDisplayName}`}><Eye className="w-4 h-4"/></button>
                                         <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${st.id}`)} className="hover:text-emerald-600 transition-colors" title="Record a payment for this student" aria-label={`Receive payment for ${studentDisplayName}`}><Wallet className="w-4 h-4"/></button>
                                      </div>
                                  </td>
                                </tr>
                              )}

                              {/* Flat Ad Hoc rendering */}
                              {ledgerStudent.other_payments?.map((op: any) => (
                                  <tr key={`flat-op-${op.id}`} className="bg-amber-50/20 hover:bg-amber-50/60 border-b border-amber-50">
                                    <td></td>
                                    <td className="px-4 py-2 pl-12">
                                      <div className="flex items-center text-amber-900/80">
                                         <span className="text-amber-300 mr-2">↳</span>
                                         <div className="flex flex-col">
                                           <span className="text-xs font-bold">{op.description}</span>
                                           <span className="text-[9px] font-bold text-amber-600/60 uppercase">{op.category_display}</span>
                                         </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{formatCurrency(op.amount)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-slate-300">-</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-amber-600">-{formatCurrency(op.total_waived || 0)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{formatCurrency(op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-xs font-black ${parseFloat(op.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(op.balance)}</span>
                                    </td>
                                    <td className="px-4 py-2 text-center">{renderStatusBadge(op.balance, op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-center">
                                       <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${st.id}`)} className="text-slate-400 hover:text-emerald-600 transition-colors mx-auto block" title="Record a payment for this charge" aria-label={`Receive payment for ${op.description}`}><Wallet className="w-3.5 h-3.5"/></button>
                                    </td>
                                  </tr>
                                ))}
                            </React.Fragment>
                          );
                        });
                      }
                      return null;
                    })}
                 </tbody>
                 <tfoot>
                   <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-800">
                     <td colSpan={2} className="px-4 py-3 text-xs uppercase tracking-widest">Page Totals</td>
                     <td className="px-4 py-3 text-right">{formatCurrency(pageTotals.billed)}</td>
                     <td className="px-4 py-3 text-right text-emerald-700">-{formatCurrency(pageTotals.discount)}</td>
                     <td className="px-4 py-3 text-right text-amber-700">-{formatCurrency(pageTotals.waived)}</td>
                     <td className="px-4 py-3 text-right">{formatCurrency(pageTotals.paid)}</td>
                     <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(pageTotals.balance)}</td>
                     <td colSpan={2}></td>
                   </tr>
                 </tfoot>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-300 rounded shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Previous</button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-300 rounded shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Add Ad-Hoc Charge Modal ── */}
        {adHocModalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={closeAdHocModal}>
            <form onSubmit={handleCreateAdHoc} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
              {/* Pinned Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">Add Incidental Charge</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">One-off charges outside the regular fee structure — fines, damages, or historical debt.</p>
                </div>
                <button type="button" onClick={closeAdHocModal} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-md shadow-sm border border-slate-200 shrink-0 ml-3" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Autocomplete Search */}
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Target Student</label>

                  {selectedChargeStudent ? (
                    <div className="flex items-center justify-between p-3 border-2 border-indigo-500 bg-indigo-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        {selectedChargeStudent.image_url ? (
                          <img src={selectedChargeStudent.image_url} alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs"><User className="w-4 h-4"/></div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-indigo-900">{toTitleCase(selectedChargeStudent.full_name)}</span>
                          <span className="text-[10px] font-bold text-indigo-600">{selectedChargeStudent.registration_number} • {selectedChargeStudent.current_class_name}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedChargeStudent(null)} className="p-1.5 hover:bg-indigo-200 rounded-lg text-indigo-500" aria-label="Clear selected student"><X className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={chargeSearchQuery}
                        onChange={(e) => setChargeSearchQuery(e.target.value)}
                        placeholder="Search name or reg number..."
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {isSearchingStudent && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin" />}

                      {/* Search Results Dropdown */}
                      {chargeSearchQuery.length >= 2 && chargeSearchResults.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {chargeSearchResults.map((st) => (
                            <li key={st.id} onClick={() => { setSelectedChargeStudent(st); setChargeSearchQuery(''); setChargeSearchResults([]); }} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0">
                              {st.image_url ? (
                                <img src={st.image_url} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs"><User className="w-4 h-4"/></div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800">{toTitleCase(st.full_name)}</span>
                                <span className="text-[10px] font-bold text-slate-400">{st.registration_number} • {st.current_class_name} {st.current_class_section_name}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Session</label>
                    <select name="session_id" required defaultValue={filterSessionId} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                      {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Term</label>
                    <select name="period_id" required defaultValue={filterPeriodId} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                      {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                  <select name="category" required value={chargeCategory} onChange={e => setChargeCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                    <option value="fine">Fine / Penalty</option>
                    <option value="damage">Damage Fee</option>
                    <option value="historical">Historical Debt</option>
                    <option value="other">Other Charge</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    {CATEGORY_DESCRIPTIONS[chargeCategory]}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description / Reason</label>
                  <input type="text" name="description" required placeholder="e.g., Replacement ID Card" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Amount (₦)</label>
                  <input type="number" name="amount" min="1" step="0.01" required placeholder="0.00" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={closeAdHocModal} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 shadow-sm">Cancel</button>
                <button type="submit" disabled={!selectedChargeStudent} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all">Apply Charge</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Student Profile Drawer ── */}
        {studentDetailModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in slide-in-from-right-8" onClick={() => setStudentDetailModal(null)}>
            <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-black text-slate-800 text-lg flex items-center"><User className="w-5 h-5 mr-2 text-indigo-500"/> Student Profile</h3>
                <button type="button" onClick={() => setStudentDetailModal(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-md shadow-sm border border-slate-200" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                 <div className="flex items-center gap-4">
                   {studentDetailModal.student.image_url ? (
                      <img src={studentDetailModal.student.image_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-inner shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-2xl shadow-inner border-2 border-white shrink-0">
                        {toTitleCase(studentDetailModal.student.full_name).charAt(0)}
                      </div>
                   )}
                   <div>
                     <h2 className="text-xl font-black text-slate-800">{toTitleCase(studentDetailModal.student.full_name)}</h2>
                     <p className="text-sm font-bold text-slate-500">{studentDetailModal.student.registration_number}</p>
                   </div>
                 </div>

                 <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enrolled Class</p>
                       <p className="text-sm font-bold text-slate-800">{studentDetailModal.student.current_class_name} {studentDetailModal.student.current_class_section_name ? `(${studentDetailModal.student.current_class_section_name})` : ''}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gender</p>
                       <p className="text-sm font-bold text-slate-800 capitalize">{studentDetailModal.student.gender || '—'}</p>
                     </div>
                   </div>

                   <div className="h-px bg-slate-200 w-full" />

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fee Balance</p>
                       <p className="text-sm font-bold text-slate-800">{formatCurrency(studentDetailModal.student.fee_balance)}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Canteen Balance</p>
                       <p className="text-sm font-bold text-slate-800">{formatCurrency(studentDetailModal.student.canteen_balance)}</p>
                     </div>
                   </div>

                   <div className="h-px bg-slate-200 w-full" />

                   {/* True Total Debt Calculation */}
                   {(() => {
                      const activeTuition = parseFloat(studentDetailModal.invoice?.balance || '0');
                      const activeAdHoc = studentDetailModal.other_payments?.reduce((acc: number, op: any) => acc + parseFloat(op.balance), 0) || 0;
                      const trueDebt = activeTuition + activeAdHoc;

                      return (
                        <div className="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                          <div>
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Total Active Debt</p>
                            <p className="text-xs font-bold text-rose-500/80">Includes tuition + ad-hoc charges</p>
                          </div>
                          <p className="text-lg font-black text-rose-600">{formatCurrency(trueDebt)}</p>
                        </div>
                      );
                   })()}
                 </div>

                 {studentDetailModal.invoice && (
                   <button onClick={() => setInvoiceDrawer({ type: 'student', parent: { parent_name: studentDetailModal.student.parent_name }, ledgerStudent: studentDetailModal })}
                     className="w-full py-2.5 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                     <FileText className="w-4 h-4" /> View Full Billing Breakdown
                   </button>
                 )}
              </div>
            </div>
          </div>
        )}

        {/* ── Invoice Detail Drawer (redesigned) ── */}
        {invoiceDrawer && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in slide-in-from-right-8" onClick={() => setInvoiceDrawer(null)}>
            <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-black text-slate-800 text-lg flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-500"/>
                  {invoiceDrawer.type === 'family' ? 'Family Invoice Details' : 'Invoice Details'}
                </h3>
                <button type="button" onClick={() => setInvoiceDrawer(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-md shadow-sm border border-slate-200" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {invoiceDrawer.type === 'student' ? (() => {
                  const { ledgerStudent, parent } = invoiceDrawer;
                  const st = ledgerStudent.student;
                  const breakdown = getStudentBreakdown(ledgerStudent);
                  return (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student</p>
                          <p className="text-lg font-bold text-slate-800">{toTitleCase(st.full_name)}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{st.current_class_name} {st.current_class_section_name ? `(${st.current_class_section_name})` : ''}</p>
                        </div>
                        {ledgerStudent.invoice && (
                          <div className="text-right">
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
                                <span className={`${it.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Balance {formatCurrency(it.balance)}</span>
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
                        {ledgerStudent.invoice && (
                          <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${ledgerStudent.invoice.id}?type=student`)}
                            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Full Detail Page
                          </button>
                        )}
                        <button onClick={() => printStudentInvoice(parent, ledgerStudent)}
                          className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-1.5">
                          <Printer className="w-3.5 h-3.5" /> Print Invoice Summary
                        </button>
                      </div>
                    </>
                  );
                })() : (() => {
                  const { parent } = invoiceDrawer;
                  const fi = parent.family_invoice;
                  return (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parent / Guardian</p>
                          <p className="text-lg font-bold text-slate-800">{toTitleCase(parent.parent_name)}</p>
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
                                <p className="text-sm font-bold text-slate-800 pr-2">{item.description}</p>
                                <p className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(item.amount)}</p>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold">
                                {parseFloat(item.total_discount || '0') > 0 && <span className="text-emerald-600">Discount -{formatCurrency(item.total_discount)}</span>}
                                {parseFloat(item.total_waived || '0') > 0 && <span className="text-amber-600">Waived -{formatCurrency(item.total_waived)}</span>}
                                <span className="text-slate-500">Paid {formatCurrency(item.amount_paid)}</span>
                                <span className={`${parseFloat(item.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Balance {formatCurrency(item.balance)}</span>
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

                      <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${fi.id}?type=family`)}
                        className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Full Detail Page
                      </button>
                      <p className="text-[11px] text-slate-400 text-center leading-relaxed">To print this family's full statement (including every ward), use the print icon on the parent row in the ledger.</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Bulk Action Confirmation ── */}
        {bulkConfirm && (
          <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setBulkConfirm(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-indigo-50 border border-indigo-100 text-indigo-600">
                {bulkConfirm.actionType === 'send_reminders' ? <Mail className="h-7 w-7"/> : <Printer className="h-7 w-7"/>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                {bulkConfirm.actionType === 'send_reminders' ? 'Send Payment Reminders?' : 'Send Statements?'}
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                This will send {bulkConfirm.actionType === 'send_reminders' ? 'a payment reminder' : 'a statement/receipt'} to <strong className="text-slate-700">{bulkConfirm.count} {viewMode === 'parent' ? 'parent' : 'student'}{bulkConfirm.count > 1 ? 's' : ''}</strong> {bulkConfirm.scope === 'all' ? '— everyone currently loaded on this page' : '— your selected records'}.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                <button onClick={() => handleBulkAction(bulkConfirm.actionType, bulkConfirm.scope)} className="flex-1 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700">Confirm &amp; Send</button>
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

      {/* ── Print Root (only rendered while a print is queued) ── */}
      {printData && (
        <div className="hidden print:block" id="print-area">
          {renderPrintContent()}
        </div>
      )}
    </>
  );
}

export default function BillingLedgerPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
      <LedgerContent />
    </Suspense>
  );
}