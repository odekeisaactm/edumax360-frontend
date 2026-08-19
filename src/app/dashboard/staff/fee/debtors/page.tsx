'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI, schoolInfoAPI } from '@/lib/api';
import { billingLedgerAPI } from '@/lib/fee.service';
import DebtorsExporter, { DebtorExportRow } from './DebtorsExporter';
import {
  AlertCircle, Check, Loader2, X, Search, FilterX, SlidersHorizontal,
  ChevronLeft, ChevronRight, Eye, Users, User, ArrowRight,
  MessageCircle, Mail, Wallet, Info, ShieldMinus, Printer, Building2, ExternalLink,
} from 'lucide-react';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return String(d.detail);
  if (d?.message) return String(d.message);
  return err?.message || 'An error occurred.';
}

function fmtMoney(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num as number)) return '₦0.00';
  return '₦' + (num as number).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const renderStatusBadge = (balanceStr: string, paidStr: string) => {
  const balance = parseFloat(balanceStr || '0');
  const paid = parseFloat(paidStr || '0');
  if (balance <= 0) return <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">Paid</span>;
  if (paid > 0) return <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap">Partial</span>;
  return <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap">Not Paid</span>;
};

const DEFAULT_PAGE_SIZE = 50;

// ───────────────────────────────────────────────────────────────────────────
// Toast stack
// ───────────────────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Itemized Breakdown Drawer — same shape/derivation as the Statement of
// Accounts invoice drawer, now available for a single student OR the whole
// family, each with its own Print action.
// ───────────────────────────────────────────────────────────────────────────
type InvoiceDrawerState =
  | { type: 'student'; parent: any; ledgerStudent: any }
  | { type: 'family'; parent: any }
  | null;

function InvoiceDrawer({
  drawer, onClose, getStudentBreakdown, getParentBreakdown, printStudentInvoice, printFamilyStatement, router,
}: {
  drawer: InvoiceDrawerState;
  onClose: () => void;
  getStudentBreakdown: (ls: any) => { items: any[]; billed: number; discount: number; waived: number; paid: number; balance: number };
  getParentBreakdown: (parent: any) => any;
  printStudentInvoice: (parent: any, ls: any) => void;
  printFamilyStatement: (parent: any) => void;
  router: any;
}) {
  if (!drawer) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {drawer.type === 'student' ? (() => {
          const { ledgerStudent, parent } = drawer;
          const st = ledgerStudent.student || {};
          const breakdown = getStudentBreakdown(ledgerStudent);
          const studentName = toTitleCase(st.full_name);
          return (
            <>
              <div className="px-6 py-5 bg-gradient-to-r from-rose-900 to-rose-800 text-white flex justify-between items-start shrink-0">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-rose-300 uppercase tracking-widest">Student Account</span>
                  <h3 className="text-lg font-bold mt-0.5 truncate">{studentName || 'Unnamed'}</h3>
                  <p className="text-xs text-rose-200 mt-1">{st.registration_number} &bull; {st.current_class_name} {st.current_class_section_name || ''}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-xl text-rose-300 hover:text-white hover:bg-white/10 shrink-0"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {ledgerStudent.invoice && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ledgerStudent.invoice.invoice_number}</span>
                    {renderStatusBadge(ledgerStudent.invoice.balance, ledgerStudent.invoice.amount_paid)}
                  </div>
                )}

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
                          <p className="text-sm font-bold text-slate-700 shrink-0">{fmtMoney(it.billed)}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold">
                          {it.discount > 0 && <span className="text-emerald-600">Discount -{fmtMoney(it.discount)}</span>}
                          {it.waived > 0 && <span className="text-amber-600">Waived -{fmtMoney(it.waived)}</span>}
                          <span className="text-slate-500">Paid {fmtMoney(it.paid)}</span>
                          <span className={it.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>Balance {fmtMoney(it.balance)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Billed</span><span>{fmtMoney(breakdown.billed)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-emerald-400"><span>Total Discount</span><span>-{fmtMoney(breakdown.discount)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-amber-400"><span>Total Waived</span><span>-{fmtMoney(breakdown.waived)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Paid</span><span>{fmtMoney(breakdown.paid)}</span></div>
                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest">Balance Due</span><span className="text-lg font-black">{fmtMoney(breakdown.balance)}</span></div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col gap-2 shrink-0">
                <div className="flex gap-2">
                  {ledgerStudent.invoice && (
                    <button onClick={() => router.push(`/dashboard/staff/fee/invoices/${ledgerStudent.invoice.id}?type=student`)}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Full Detail Page
                    </button>
                  )}
                  <button onClick={() => printStudentInvoice(parent, ledgerStudent)}
                    className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" /> Print Summary
                  </button>
                </div>
                <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${ledgerStudent.id}`)}
                  className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">
                  Record Payment
                </button>
              </div>
            </>
          );
        })() : (() => {
          const { parent } = drawer;
          const pb = getParentBreakdown(parent);
          return (
            <>
              <div className="px-6 py-5 bg-gradient-to-r from-rose-900 to-rose-800 text-white flex justify-between items-start shrink-0">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-rose-300 uppercase tracking-widest">Family Account</span>
                  <h3 className="text-lg font-bold mt-0.5 truncate">{toTitleCase(parent.parent_name) || 'Unnamed Family'}</h3>
                  {parent.phone && <p className="text-xs text-rose-200 mt-1">{parent.phone}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-xl text-rose-300 hover:text-white hover:bg-white/10 shrink-0"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Due</span>
                  <span className="text-2xl font-black text-rose-900">{fmtMoney(parent.grand_total_outstanding)}</span>
                </div>

                {pb.children.map(({ ledgerStudent, breakdown }: any) => (
                  <div key={ledgerStudent.id} className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" /> {toTitleCase(ledgerStudent.student?.full_name)}
                    </h4>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <ul className="divide-y divide-slate-100">
                        {breakdown.items.length === 0 ? (
                          <li className="p-3 text-center text-xs font-medium text-slate-400">No billed items.</li>
                        ) : breakdown.items.map((it: any, i: number) => (
                          <li key={i} className="p-3">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-bold text-slate-800 pr-2">{it.description}</p>
                              <p className="text-xs font-bold text-slate-700 shrink-0">{fmtMoney(it.billed)}</p>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold">
                              {it.discount > 0 && <span className="text-emerald-600">-{fmtMoney(it.discount)} disc.</span>}
                              {it.waived > 0 && <span className="text-amber-600">-{fmtMoney(it.waived)} waived</span>}
                              <span className={it.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>Bal {fmtMoney(it.balance)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}

                {pb.family && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldMinus className="h-3.5 w-3.5" /> Family Shared Fees
                    </h4>
                    <div className="bg-purple-50/50 rounded-xl border border-purple-100 overflow-hidden">
                      <ul className="divide-y divide-purple-100">
                        {(pb.family.items || []).map((it: any, i: number) => (
                          <li key={i} className="p-3">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-bold text-slate-800 pr-2">{it.description}</p>
                              <p className="text-xs font-bold text-slate-700 shrink-0">{fmtMoney(it.amount)}</p>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold">
                              {parseFloat(it.total_discount || '0') > 0 && <span className="text-emerald-600">-{fmtMoney(it.total_discount)} disc.</span>}
                              {parseFloat(it.total_waived || '0') > 0 && <span className="text-amber-600">-{fmtMoney(it.total_waived)} waived</span>}
                              <span className={parseFloat(it.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}>Bal {fmtMoney(it.balance)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Billed</span><span>{fmtMoney(pb.billed)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-emerald-400"><span>Total Discount</span><span>-{fmtMoney(pb.discount)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-amber-400"><span>Total Waived</span><span>-{fmtMoney(pb.waived)}</span></div>
                  <div className="flex justify-between text-xs font-bold text-slate-300"><span>Total Paid</span><span>{fmtMoney(pb.paid)}</span></div>
                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest">Balance Due</span><span className="text-lg font-black">{fmtMoney(pb.balance)}</span></div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
                <button onClick={() => printFamilyStatement(parent)}
                  className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Print Family Statement
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Main content
// ───────────────────────────────────────────────────────────────────────────
function DebtorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { hasPermission, user, schoolInfo: authSchoolInfo } = useAuth();
  const canManageFees = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [mode, setMode] = useState<'parent' | 'student'>('parent');
  const [showFilters, setShowFilters] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  const [sessionFilter, setSessionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [invoiceDrawer, setInvoiceDrawer] = useState<InvoiceDrawerState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Print state ──
  const [schoolBranding, setSchoolBranding] = useState<any>(null);
  const [printData, setPrintData] = useState<{ kind: 'student_invoice'; parent: any; ledgerStudent: any } | { kind: 'family_statement'; parent: any } | null>(null);

  const fetchRequestIdRef = useRef(0);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // ── Reference data: sessions + current session/term default ──
  useEffect(() => {
    academicAPI.listClasses().then(c => setClasses(Array.isArray(c) ? c : c?.results || []));
    schoolInfoAPI.get().then((d: any) => setSchoolBranding(d)).catch(() => setSchoolBranding(null));

    const init = async () => {
      try {
        const [sessData, curSessRaw] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession(),
        ]);
        setSessions(Array.isArray(sessData) ? sessData : sessData?.results || []);
        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        if (curSess?.id) setSessionFilter(curSess.id.toString());
      } catch {
        // best-effort — falls back to "All-Time" if this fails
      } finally {
        setRefLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (refLoading) return;
    if (!sessionFilter) { setPeriods([]); setPeriodFilter(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionFilter) }).then(p => {
      const periodsList = Array.isArray(p) ? p : p?.results || [];
      setPeriods(periodsList);
      if (periodsList.length > 0 && !periodsList.find((pp: any) => pp.id.toString() === periodFilter)) {
        const currentP = periodsList.find((pp: any) => pp.is_current);
        setPeriodFilter((currentP || periodsList[0]).id.toString());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFilter, refLoading]);

  useEffect(() => {
    if (classFilter) {
      academicAPI.listClassSections({ class_id: Number(classFilter) })
        .then(s => setSections(Array.isArray(s) ? s : s?.results || []));
    } else { setSections([]); setSectionFilter(''); }
  }, [classFilter]);

  // ── Fetch debtors ──
  const fetchDebtors = useCallback(async () => {
    if (!canManageFees || refLoading) return;
    const requestId = ++fetchRequestIdRef.current;
    setLoading(prev => (data.length === 0 ? true : prev));
    try {
      const params: any = { debtors_only: true, mode, page, page_size: pageSize };
      if (sessionFilter) params.session_id = sessionFilter;
      if (periodFilter) params.period_id = periodFilter;
      if (classFilter) params.class_id = classFilter;
      if (sectionFilter) params.section_id = sectionFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await feeAPI.getBillingLedger(params);
      if (requestId !== fetchRequestIdRef.current) return;

      const results = Array.isArray(res) ? res : res?.results ?? [];
      const count = typeof res?.count === 'number' ? res.count : results.length;
      const effectivePageSize = res?.page_size || res?.results_per_page || pageSize;

      setData(results);
      setTotalCount(count);
      if (res?.page_size || res?.results_per_page) setPageSize(effectivePageSize);
      setSelectedIds([]);
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      showToast('error', extractError(err));
    } finally {
      if (requestId === fetchRequestIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery, canManageFees, pageSize, refLoading]);

  useEffect(() => { fetchDebtors(); }, [fetchDebtors]);
  useEffect(() => { setPage(1); }, [mode, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery]);

  // ── Deep-link catch (return from Waivers page) ──
  useEffect(() => {
    const studentId = searchParams.get('student_id');
    const parentId = searchParams.get('parent_id');
    const targetId = studentId || parentId;
    if (targetId && !loading && data.length > 0) {
      const found = data.find(d => String(d.parent_id) === String(targetId) || String(d.students?.[0]?.id) === String(targetId));
      if (found) {
        setInvoiceDrawer(mode === 'parent'
          ? { type: 'family', parent: found }
          : { type: 'student', parent: found, ledgerStudent: found.students?.[0] });
        const p = new URLSearchParams(searchParams.toString());
        p.delete('student_id'); p.delete('parent_id');
        const newUrl = p.toString() ? `${pathname}?${p.toString()}` : pathname;
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [searchParams, data, loading, router, pathname, mode]);

  // ── Reminders ──
  const handleSingleRemind = async (row: any) => {
    const parent_id = row.parent_id;
    try {
      await billingLedgerAPI.bulkAction({
        action: 'send_reminders',
        target_type: 'parent',
        target_ids: [parent_id],
        session_id: sessionFilter ? Number(sessionFilter) : undefined,
        period_id: periodFilter ? Number(periodFilter) : undefined,
      });
      showToast('success', 'Reminder queued for dispatch.');
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleBulkRemind = async () => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const parent_ids = mode === 'parent'
        ? selectedIds
        : selectedIds.map(sid => data.find(d => d.students?.[0]?.id === sid)?.parent_id).filter(Boolean);

      await billingLedgerAPI.bulkAction({
        action: 'send_reminders',
        target_type: 'parent',
        target_ids: parent_ids,
        session_id: sessionFilter ? Number(sessionFilter) : undefined,
        period_id: periodFilter ? Number(periodFilter) : undefined,
      });
      showToast('success', `Reminders queued for ${parent_ids.length} recipient(s).`);
      setSelectedIds([]);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Export ──
  const getExportRows = useCallback(async (): Promise<DebtorExportRow[]> => {
    const params: any = { debtors_only: true, mode, page_size: 5000 };
    if (sessionFilter) params.session_id = sessionFilter;
    if (periodFilter) params.period_id = periodFilter;
    if (classFilter) params.class_id = classFilter;
    if (sectionFilter) params.section_id = sectionFilter;
    if (searchQuery.trim()) params.q = searchQuery.trim();

    const res = await feeAPI.getBillingLedger(params);
    const results = Array.isArray(res) ? res : res?.results ?? [];

    return results.map((d: any) => {
      if (mode === 'parent') {
        return {
          id: d.parent_id,
          name: toTitleCase(d.parent_name) || 'Unnamed Family',
          type: 'Parent',
          contactOrClass: d.phone || '—',
          totalOwed: d.grand_total_outstanding,
        };
      }
      const ls = d.students?.[0];
      return {
        id: ls?.id ?? d.parent_id,
        name: toTitleCase(ls?.student?.full_name) || 'Unknown',
        type: 'Student',
        contactOrClass: ls?.student?.current_class_name || '—',
        totalOwed: d.grand_total_outstanding,
      };
    });
  }, [mode, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery]);

  const currentSessionLabel = useMemo(() => {
    if (!sessionFilter) return 'All-Time';
    const s = sessions.find(s => s.id == sessionFilter);
    return s ? (s.name || `${s.start_year}/${s.end_year}`) : 'All-Time';
  }, [sessionFilter, sessions]);

  const currentPeriodLabel = useMemo(() => {
    if (!periodFilter) return '';
    return periods.find(p => p.id == periodFilter)?.name || periods.find(p => p.id == periodFilter)?.period?.name || '';
  }, [periodFilter, periods]);

  const filterSummaryString = [
    mode === 'parent' ? 'Parent Mode' : 'Student Mode',
    currentSessionLabel,
    currentPeriodLabel,
    classFilter ? classes.find(c => c.id == classFilter)?.name : '',
    sectionFilter ? sections.find(s => s.id == sectionFilter)?.name : '',
  ].filter(Boolean).join(' | ');

  const activeFilterCount = [classFilter, sectionFilter].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ─────────────────────────────────────────────────────────────────────────
  // Breakdown helpers
  // ─────────────────────────────────────────────────────────────────────────
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

  // ── Print triggers ──
  const printStudentInvoice = (parent: any, ledgerStudent: any) => {
    setInvoiceDrawer(null);
    setPrintData({ kind: 'student_invoice', parent, ledgerStudent });
  };
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

  // ── Print content ──
  const renderPrintContent = () => {
    if (!printData) return null;
    const printedOn = new Date().toLocaleString('en-GB');
    const staffName = `${(user as any)?.first_name || ''} ${(user as any)?.last_name || ''}`.trim() || 'Finance Office';

    const Letterhead = () => (
      <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-4 mb-6">
        {schoolBranding?.logo ? (
          <img src={schoolBranding.logo} alt="School Logo" className="h-16 w-16 object-contain" />
        ) : (
          <div className="h-16 w-16 flex items-center justify-center bg-slate-100 rounded"><Building2 className="h-8 w-8 text-slate-400" /></div>
        )}
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">{schoolBranding?.name || 'School'}</h1>
          {schoolBranding?.address && <p className="text-xs text-slate-600">{schoolBranding.address}</p>}
          <p className="text-xs text-slate-600">{[schoolBranding?.email, schoolBranding?.mobile_1].filter(Boolean).join('  |  ')}</p>
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
          <h2 className="text-center text-lg font-black uppercase tracking-widest mb-6">Outstanding Balance Summary</h2>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p><strong>Student:</strong> {toTitleCase(st.full_name)}</p>
              <p><strong>Reg No:</strong> {st.registration_number}</p>
              <p><strong>Class:</strong> {st.current_class_name} {st.current_class_section_name || ''}</p>
            </div>
            <div className="text-right">
              <p><strong>Parent/Guardian:</strong> {toTitleCase(parent.parent_name)}</p>
              <p><strong>Session:</strong> {currentSessionLabel}</p>
              <p><strong>Term:</strong> {currentPeriodLabel || 'All-Time'}</p>
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
                  <td className="text-right py-2">{fmtMoney(it.billed)}</td>
                  <td className="text-right py-2 text-emerald-700">-{fmtMoney(it.discount)}</td>
                  <td className="text-right py-2 text-amber-700">-{fmtMoney(it.waived)}</td>
                  <td className="text-right py-2">{fmtMoney(it.paid)}</td>
                  <td className="text-right py-2 font-bold">{fmtMoney(it.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-black">
                <td className="py-2">TOTAL</td>
                <td className="text-right py-2">{fmtMoney(breakdown.billed)}</td>
                <td className="text-right py-2">-{fmtMoney(breakdown.discount)}</td>
                <td className="text-right py-2">-{fmtMoney(breakdown.waived)}</td>
                <td className="text-right py-2">{fmtMoney(breakdown.paid)}</td>
                <td className="text-right py-2 text-base">{fmtMoney(breakdown.balance)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-between items-center bg-slate-100 p-4 rounded mb-8">
            <span className="font-black uppercase text-sm">Balance Due</span>
            <span className="font-black text-xl">{fmtMoney(breakdown.balance)}</span>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Issued By: {staffName}</div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2">Signature &amp; Stamp</div></div>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-8">Printed on {printedOn} — This is a summary of outstanding charges, not a payment receipt.</p>
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
            <p><strong>Session:</strong> {currentSessionLabel} &nbsp;&nbsp; <strong>Term:</strong> {currentPeriodLabel || 'All-Time'}</p>
          </div>

          {pb.children.map(({ ledgerStudent, breakdown }: any) => (
            <div key={ledgerStudent.id} className="mb-6">
              <h3 className="font-bold text-sm bg-slate-100 px-3 py-1.5 rounded">
                {toTitleCase(ledgerStudent.student.full_name)} — {ledgerStudent.student.current_class_name} {ledgerStudent.student.current_class_section_name || ''}
              </h3>
              <table className="w-full text-xs border-collapse mt-2">
                <tbody>
                  {breakdown.items.map((it: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5">{it.description}</td>
                      <td className="text-right py-1.5">{fmtMoney(it.billed)}</td>
                      <td className="text-right py-1.5 text-emerald-700">-{fmtMoney(it.discount)}</td>
                      <td className="text-right py-1.5 text-amber-700">-{fmtMoney(it.waived)}</td>
                      <td className="text-right py-1.5">{fmtMoney(it.paid)}</td>
                      <td className="text-right py-1.5 font-bold">{fmtMoney(it.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-xs font-bold mt-1">Subtotal: {fmtMoney(breakdown.balance)}</p>
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
                      <td className="text-right py-1.5">{fmtMoney(it.amount)}</td>
                      <td className="text-right py-1.5 text-emerald-700">-{fmtMoney(it.total_discount)}</td>
                      <td className="text-right py-1.5 text-amber-700">-{fmtMoney(it.total_waived)}</td>
                      <td className="text-right py-1.5">{fmtMoney(it.amount_paid)}</td>
                      <td className="text-right py-1.5 font-bold">{fmtMoney(it.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-xs font-bold mt-1">Subtotal: {fmtMoney(pb.family.balance)}</p>
            </div>
          )}

          <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded mt-8">
            <span className="font-black uppercase text-sm">Total Family Balance Due</span>
            <span className="font-black text-xl">{fmtMoney(pb.balance)}</span>
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

  if (!canManageFees) return <div className="p-16 text-center text-red-600 font-bold">Access Denied</div>;

  return (
    <>
      <div className="space-y-4 pb-28 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 print:hidden">
        <ToastStack toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />

        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white border border-slate-200 shadow-2xl rounded-full px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-6 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 sm:pr-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xs font-bold">{selectedIds.length}</span>
              <span className="text-sm font-bold text-slate-700 hidden sm:inline">Selected</span>
            </div>
            <button onClick={() => setSelectedIds([])} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Clear</button>
            <button onClick={handleBulkRemind} disabled={bulkActionLoading} className="px-4 sm:px-5 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-full shadow-md shadow-rose-200 hover:bg-rose-700 flex items-center gap-2 transition-all disabled:opacity-60">
              {bulkActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} <span className="hidden sm:inline">Send</span> Reminders
            </button>
          </div>
        )}

        <InvoiceDrawer
          drawer={invoiceDrawer}
          onClose={() => setInvoiceDrawer(null)}
          getStudentBreakdown={getStudentBreakdown}
          getParentBreakdown={getParentBreakdown}
          printStudentInvoice={printStudentInvoice}
          printFamilyStatement={printFamilyStatement}
          router={router}
        />

        {/* ── Compact, mobile-first control panel ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 shrink-0 bg-rose-100 rounded-xl flex items-center justify-center shadow-sm">
                <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">Outstanding Balances</h1>
                <p className="text-[11px] text-slate-400 truncate hidden sm:block">Unpaid tuition, family, and ad-hoc charges.</p>
              </div>
            </div>
            <DebtorsExporter schoolName={authSchoolInfo?.name} filterSummary={filterSummaryString} getExportRows={getExportRows} />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-50 p-1 rounded-xl flex items-center shrink-0">
              <button onClick={() => setMode('parent')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${mode === 'parent' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Users className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Families</span>
              </button>
              <button onClick={() => setMode('student')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${mode === 'student' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <User className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Students</span>
              </button>
            </div>
            <div className="flex-1 min-w-0 bg-rose-50 border border-rose-100 rounded-xl px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider shrink-0">Total</span>
              <span className="text-sm sm:text-base font-black text-rose-900 truncate">{totalCount.toLocaleString()} {mode === 'parent' ? 'Families' : 'Students'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <select value={sessionFilter} onChange={e => { setSessionFilter(e.target.value); setPeriodFilter(''); }} className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-700">
              <option value="">All-Time (Historical)</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
            </select>
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} disabled={!sessionFilter} className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-700 disabled:opacity-50">
              <option value="">All Terms</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder={`Search ${mode}s...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
            </div>
            <button onClick={() => setShowFilters(s => !s)} className={`relative shrink-0 p-2.5 rounded-xl border transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`} title="Class / Section filters">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
              <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSectionFilter(''); }} className="flex-1 min-w-[120px] px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium">
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} disabled={!classFilter || sections.length === 0} className="flex-1 min-w-[120px] px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium disabled:opacity-50">
                <option value="">All Arms</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {(classFilter || searchQuery) && (
                <button onClick={() => { setClassFilter(''); setSectionFilter(''); setSearchQuery(''); }} className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-colors" title="Clear Filters"><FilterX className="h-4 w-4" /></button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input type="checkbox" className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                      checked={data.length > 0 && selectedIds.length === (mode === 'parent' ? data.length : data.length)}
                      onChange={e => setSelectedIds(e.target.checked ? (mode === 'parent' ? data.map(d => d.parent_id) : data.map(d => d.students?.[0]?.id).filter(Boolean)) : [])}
                    />
                  </th>
                  <th className="px-4 py-3 font-bold text-slate-700">{mode === 'parent' ? 'Family / Sponsor' : 'Student Profile'}</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-right">Total Billed</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-right">Discount</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-right">Waived</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-right">Paid</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-right">Balance</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-center">Status</th>
                  <th className="px-4 py-3 font-bold text-slate-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-rose-600 mx-auto" /><p className="text-xs font-medium text-slate-400 mt-2">Loading debtors...</p></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={9} className="py-20 text-center text-slate-400">No outstanding balances found for these filters.</td></tr>
                ) : (
                  data.map(parent => {
                    const isChecked = selectedIds.includes(mode === 'parent' ? parent.parent_id : parent.students?.[0]?.id);
                    const toggleCheck = () => {
                      const rowId = mode === 'parent' ? parent.parent_id : parent.students?.[0]?.id;
                      if (!rowId) return;
                      setSelectedIds(prev => prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]);
                    };

                    if (mode === 'parent') {
                      return (
                        <React.Fragment key={`parent-${parent.parent_id}`}>
                          <tr className="bg-[#e9ecef] border-t border-slate-300 hover:bg-slate-200 transition-colors">
                            <td className="px-4 py-3 text-center">
                              <input type="checkbox" checked={isChecked} onChange={toggleCheck} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" />
                            </td>
                            <td colSpan={5} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-700" />
                                <span className="font-black text-slate-800 text-[13px] uppercase tracking-wide">{toTitleCase(parent.parent_name) || 'Unnamed Family'}</span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold rounded shadow-sm">{parent.students?.length || 0} Ward(s)</span>
                                {parent.phone && <span className="text-[11px] text-slate-500 font-bold ml-1">{parent.phone}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-[15px] font-black text-rose-600">{fmtMoney(parent.grand_total_outstanding)}</span>
                            </td>
                            <td colSpan={2} className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?parent_id=${parent.parent_id}`)} className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded shadow-sm hover:bg-slate-700 flex items-center" title="Record a payment against this family's balance">
                                  <Wallet className="w-3.5 h-3.5 mr-1.5" /> Receive
                                </button>
                                <button onClick={() => printFamilyStatement(parent)} className="p-2 bg-white border border-slate-300 text-slate-500 rounded shadow-sm hover:bg-slate-100 hover:text-slate-900 transition-colors" title="Print family statement"><Printer className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleSingleRemind(parent)} className="p-2 bg-white border border-slate-300 text-slate-500 rounded shadow-sm hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="Send reminder"><Mail className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setInvoiceDrawer({ type: 'family', parent })} className="p-2 bg-white border border-slate-300 text-slate-500 rounded shadow-sm hover:bg-slate-100 hover:text-rose-600 transition-colors" title="View breakdown"><Eye className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>

                          {(parent.students || []).map((ls: any) => {
                            const st = ls.student || {};
                            const studentName = toTitleCase(st.full_name);
                            return (
                              <React.Fragment key={`stu-${ls.id}`}>
                                {ls.invoice && (
                                  <tr className="hover:bg-slate-50">
                                    <td></td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {st.image_url ? (
                                          <img src={st.image_url} alt={studentName} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0"><User className="w-3.5 h-3.5" /></div>
                                        )}
                                        <div className="flex flex-col">
                                          <span className="font-bold text-slate-800">{studentName}</span>
                                          <span className="text-[10px] font-bold text-slate-400">{st.registration_number} &bull; {st.current_class_name} {st.current_class_section_name || ''}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600">{fmtMoney(ls.invoice.total_amount)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600">-{fmtMoney(ls.invoice.total_discount)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-amber-600">-{fmtMoney(ls.invoice.total_waived)}</td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600">{fmtMoney(ls.invoice.amount_paid)}</td>
                                    <td className="px-4 py-3 text-right"><span className={`font-black ${parseFloat(ls.invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(ls.invoice.balance)}</span></td>
                                    <td className="px-4 py-3 text-center">{renderStatusBadge(ls.invoice.balance, ls.invoice.amount_paid)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center gap-2 text-slate-400">
                                        <button onClick={() => setInvoiceDrawer({ type: 'student', parent, ledgerStudent: ls })} className="hover:text-rose-600 transition-colors" title="View breakdown"><Eye className="w-4 h-4" /></button>
                                        <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${ls.id}`)} className="hover:text-emerald-600 transition-colors" title="Record payment"><Wallet className="w-4 h-4" /></button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {(ls.other_payments || []).map((op: any) => (
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
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{fmtMoney(op.amount)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-slate-300">-</td>
                                    <td className="px-4 py-2 text-right text-xs font-bold text-amber-600">-{fmtMoney(op.total_waived || 0)}</td>
                                    <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{fmtMoney(op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-right"><span className={`text-xs font-black ${parseFloat(op.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(op.balance)}</span></td>
                                    <td className="px-4 py-2 text-center">{renderStatusBadge(op.balance, op.amount_paid)}</td>
                                    <td className="px-4 py-2 text-center">
                                      <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${ls.id}`)} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Record payment"><Wallet className="w-3.5 h-3.5" /></button>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}

                          {parent.family_invoice && (
                            <tr className="bg-purple-50/20 hover:bg-purple-50/50 transition-colors border-t border-purple-100">
                              <td></td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><ShieldMinus className="w-4 h-4" /></div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-purple-900">Family Shared Fees</span>
                                    <span className="text-[10px] font-bold text-purple-400">{parent.family_invoice.invoice_number}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-purple-700">{fmtMoney(parent.family_invoice.total_amount)}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600">-{fmtMoney(parent.family_invoice.total_discount)}</td>
                              <td className="px-4 py-3 text-right font-bold text-amber-600">-{fmtMoney(parent.family_invoice.total_waived)}</td>
                              <td className="px-4 py-3 text-right font-medium text-purple-700">{fmtMoney(parent.family_invoice.amount_paid)}</td>
                              <td className="px-4 py-3 text-right"><span className={`font-black ${parseFloat(parent.family_invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(parent.family_invoice.balance)}</span></td>
                              <td className="px-4 py-3 text-center">{renderStatusBadge(parent.family_invoice.balance, parent.family_invoice.amount_paid)}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?parent_id=${parent.parent_id}`)} className="text-purple-300 hover:text-emerald-600 transition-colors" title="Record payment"><Wallet className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          )}
                          <tr className="border-0 bg-transparent"><td colSpan={9} className="h-3"></td></tr>
                        </React.Fragment>
                      );
                    }

                    // ── Student mode: each row already wraps exactly one student ──
                    const ls = parent.students?.[0];
                    if (!ls) return null;
                    const st = ls.student || {};
                    const studentName = toTitleCase(st.full_name);
                    return (
                      <React.Fragment key={`flat-${ls.id}`}>
                        {ls.invoice && (
                          <tr className="hover:bg-slate-50 border-b border-slate-100">
                            <td className="px-4 py-3 text-center">
                              <input type="checkbox" checked={isChecked} onChange={toggleCheck} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {st.image_url ? (
                                  <img src={st.image_url} alt={studentName} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0"><User className="w-4 h-4" /></div>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-800">{studentName}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{st.registration_number} &bull; {st.current_class_name} {st.current_class_section_name || ''}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">{fmtMoney(ls.invoice.total_amount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">-{fmtMoney(ls.invoice.total_discount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-600">-{fmtMoney(ls.invoice.total_waived)}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">{fmtMoney(ls.invoice.amount_paid)}</td>
                            <td className="px-4 py-3 text-right"><span className={`font-black ${parseFloat(ls.invoice.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(ls.invoice.balance)}</span></td>
                            <td className="px-4 py-3 text-center">{renderStatusBadge(ls.invoice.balance, ls.invoice.amount_paid)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2 text-slate-400">
                                <button onClick={() => setInvoiceDrawer({ type: 'student', parent, ledgerStudent: ls })} className="hover:text-rose-600 transition-colors" title="View breakdown"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${ls.id}`)} className="hover:text-emerald-600 transition-colors" title="Record payment"><Wallet className="w-4 h-4" /></button>
                                <button onClick={() => handleSingleRemind(parent)} className="hover:text-indigo-600 transition-colors" title="Send reminder"><Mail className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {(ls.other_payments || []).map((op: any) => (
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
                            <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{fmtMoney(op.amount)}</td>
                            <td className="px-4 py-2 text-right text-xs font-bold text-slate-300">-</td>
                            <td className="px-4 py-2 text-right text-xs font-bold text-amber-600">-{fmtMoney(op.total_waived || 0)}</td>
                            <td className="px-4 py-2 text-right text-xs font-medium text-amber-900/70">{fmtMoney(op.amount_paid)}</td>
                            <td className="px-4 py-2 text-right"><span className={`text-xs font-black ${parseFloat(op.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(op.balance)}</span></td>
                            <td className="px-4 py-2 text-center">{renderStatusBadge(op.balance, op.amount_paid)}</td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => router.push(`/dashboard/staff/fee/payments/new?student_id=${ls.id}`)} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Record payment"><Wallet className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                        {/* Family Invoice mapping removed from here (Student mode) */}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalCount > pageSize && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
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

export default function DebtorsPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>}>
      <DebtorsContent />
    </Suspense>
  );
}