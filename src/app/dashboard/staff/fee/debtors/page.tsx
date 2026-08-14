'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { billingLedgerAPI } from '@/lib/fee.service';
import {
  AlertCircle, Check, Loader2, X, Search, FilterX, RefreshCw,
  ChevronLeft, ChevronRight, Eye, Users, User, ArrowRight, MessageCircle, Mail
} from 'lucide-react';
import DebtorsExporter, { DebtorExportRow } from './DebtorsExporter';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return String(d.detail);
  return err?.message || 'An error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const PAGE_SIZE = 50;

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 mt-0.5 text-green-600" /> : <AlertCircle className="h-4 w-4 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Deep-Dive Ledger Drawer ───────────────────────────────────────────────────
function LedgerDrawer({ item, mode, onClose, router, pathname }: any) {
  if (!item) return null;

  const isParent = mode === 'parent';
  const name = isParent ? item.__str__ : item.students[0]?.student?.full_name || item.students[0]?.__str__;
  const regNo = !isParent ? item.students[0]?.registration_number : '';
  const className = !isParent && item.students[0]?.current_class ? `${item.students[0].current_class.name} ${item.students[0].student.current_class_section?.name || ''}` : '';

  // Consolidate all debts for display
  let debts: any[] = [];
  if (item.family_invoice && parseFloat(item.family_invoice.balance) > 0) {
    debts.push({ type: 'Family Invoice', desc: item.family_invoice.invoice_number, amount: item.family_invoice.balance, date: item.family_invoice.issue_date });
  }
  item.students.forEach((s: any) => {
    if (s.invoice && parseFloat(s.invoice.balance) > 0) {
      debts.push({ type: 'Student Tuition', desc: s.invoice.invoice_number + (isParent ? ` (${s.student.first_name})` : ''), amount: s.invoice.balance, date: s.invoice.issue_date });
    }
    s.other_payments?.forEach((op: any) => {
      if (parseFloat(op.balance) > 0) {
        debts.push({ type: 'Ad-hoc / Fine', desc: op.description + (isParent ? ` (${s.student.first_name})` : ''), amount: op.balance, date: op.created_at });
      }
    });
  });

  const handleApplyWaiver = (studentId: number) => {
    router.push(`/dashboard/staff/fee/waivers?student_id=${studentId}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 bg-gradient-to-r from-rose-900 to-rose-800 text-white flex justify-between items-start shrink-0">
          <div>
            <span className="text-xs font-mono text-rose-300 uppercase tracking-widest">{isParent ? 'Family' : 'Student'} Account</span>
            <h3 className="text-lg font-bold mt-0.5">{toTitleCase(name)}</h3>
            {!isParent && <p className="text-xs text-rose-200 mt-1">{regNo} &bull; {className}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-rose-300 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Due</span>
            <span className="text-2xl font-black text-rose-900">{fmtMoney(item.grand_total_outstanding)}</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Debt Breakdown</h4>
            <div className="space-y-2">
              {debts.map((d, idx) => (
                <div key={idx} className="p-3.5 bg-white border border-slate-100 shadow-sm rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{d.type}</span>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{d.desc}</p>
                  </div>
                  <span className="font-bold text-slate-900">{fmtMoney(d.amount)}</span>
                </div>
              ))}
              {debts.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No active debts found.</p>}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col gap-2 shrink-0">
          {isParent ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase text-center block">Apply Waiver for Ward:</span>
              <div className="flex flex-wrap gap-2 justify-center">
                {item.students.map((s: any) => (
                  <button key={s.id} onClick={() => handleApplyWaiver(s.id)} className="px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors">
                    {s.student.first_name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => handleApplyWaiver(item.students[0].id)} className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">
              Apply Concession / Waiver
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function DebtorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { hasPermission, user, schoolInfo } = useAuth();
  const canManageFees = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [mode, setMode] = useState<'parent' | 'student'>('parent');

  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [sessionFilter, setSessionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [selectedLedger, setSelectedLedger] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // 1. Initial Load (References)
  useEffect(() => {
    academicCalendarAPI.listSessions().then(s => setSessions(Array.isArray(s) ? s : s.results || []));
    academicAPI.listClasses().then(c => setClasses(Array.isArray(c) ? c : c.results || []));
  }, []);

  useEffect(() => {
    if (sessionFilter) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionFilter) })
        .then(p => setPeriods(Array.isArray(p) ? p : p.results || []));
    } else { setPeriods([]); setPeriodFilter(''); }
  }, [sessionFilter]);

  useEffect(() => {
    if (classFilter) {
      academicAPI.listClassSections({ class_id: Number(classFilter) })
        .then(s => setSections(Array.isArray(s) ? s : s.results || []));
    } else { setSections([]); setSectionFilter(''); }
  }, [classFilter]);

  // 2. Fetch Data
  const fetchDebtors = useCallback(async () => {
    if (!canManageFees) return;
    setLoading(true);
    try {
      const params: any = { debtors_only: true, mode, page, page_size: PAGE_SIZE };
      if (sessionFilter) params.session_id = sessionFilter;
      if (periodFilter) params.period_id = periodFilter;
      if (classFilter) params.class_id = classFilter;
      if (sectionFilter) params.section_id = sectionFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      // Ensure your api.ts exposes feeAPI.getBillingLedger mapping to newFeeAPI.billingLedger.get
      const res = await feeAPI.getBillingLedger(params);
      const results = Array.isArray(res) ? res : res?.results ?? [];
      const count = typeof res?.count === 'number' ? res.count : results.length;

      setData(results);
      setTotalCount(count);
      setSelectedIds([]); // Clear selection on fetch
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [mode, page, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery, canManageFees]);

  useEffect(() => { fetchDebtors(); }, [fetchDebtors]);
  useEffect(() => { setPage(1); }, [mode, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery]);

  // 3. Deep-Link Catch Logic (from Waivers page return)
  useEffect(() => {
    const studentId = searchParams.get('student_id');
    const parentId = searchParams.get('parent_id');
    const targetId = studentId || parentId;

    if (targetId && !loading && data.length > 0) {
      const found = data.find(d => String(d.id) === String(targetId));
      if (found) {
        setSelectedLedger(found);
        // Clean URL so it doesn't re-trigger on refresh
        const params = new URLSearchParams(searchParams.toString());
        params.delete('student_id'); params.delete('parent_id');
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [searchParams, data, loading, router, pathname]);

  // 4. Single & Bulk Reminders
  const handleSingleRemind = async (id: number) => {
    const row = data.find(d => d.id === id);
    const parent_id = mode === 'parent' ? id : row?.parent_id || id;
    try {
      await billingLedgerAPI.bulkAction({
        action: 'send_reminders',
        target_type: 'parent',
        target_ids: [parent_id],
        session_id: sessionFilter ? Number(sessionFilter) : undefined,
        period_id: periodFilter ? Number(periodFilter) : undefined,
      });
      showToast('success', 'Reminder queued for dispatch successfully.');
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
        : selectedIds.map(id => data.find(d => d.id === id)?.parent_id || id);
        
      await billingLedgerAPI.bulkAction({
        action: 'send_reminders',
        target_type: 'parent',
        target_ids: parent_ids,
        session_id: sessionFilter ? Number(sessionFilter) : undefined,
        period_id: periodFilter ? Number(periodFilter) : undefined,
      });
      showToast('success', 'Reminders queued for dispatch successfully.');
      setSelectedIds([]);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 5. Exporter Generator
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
          id: d.id,
          name: d.__str__,
          type: 'Parent',
          contactOrClass: d.mobile || '—',
          totalOwed: d.grand_total_outstanding
        };
      } else {
        const stu = d.students[0];
        return {
          id: d.id,
          name: stu?.__str__ || 'Unknown',
          type: 'Student',
          contactOrClass: stu?.current_class?.name || '—',
          totalOwed: d.grand_total_outstanding
        };
      }
    });
  }, [mode, sessionFilter, periodFilter, classFilter, sectionFilter, searchQuery]);

  const filterSummaryString = [
    mode === 'parent' ? 'Parent Mode' : 'Student Mode',
    sessionFilter ? sessions.find(s => s.id == sessionFilter)?.name || 'Filtered Session' : 'All-Time',
    periodFilter ? periods.find(p => p.id == periodFilter)?.name : '',
    classFilter ? classes.find(c => c.id == classFilter)?.name : '',
    sectionFilter ? sections.find(s => s.id == sectionFilter)?.name : '',
  ].filter(Boolean).join(' | ');

  if (!canManageFees) return <div className="p-16 text-center text-red-600 font-bold">Access Denied</div>;

  return (
    <div className="space-y-6 pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white border border-slate-200 shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-sm font-bold text-slate-700">Selected</span>
          </div>
          <button onClick={() => setSelectedIds([])} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Clear</button>
          <button onClick={handleBulkRemind} disabled={bulkActionLoading} className="px-5 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-full shadow-md shadow-rose-200 hover:bg-rose-700 flex items-center gap-2 transition-all">
            {bulkActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Send Reminders
          </button>
        </div>
      )}

      {/* Drawer */}
      <LedgerDrawer item={selectedLedger} mode={mode} onClose={() => setSelectedLedger(null)} router={router} pathname={pathname} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center shadow-sm">
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
            Outstanding Balances (Debtors)
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Track and manage unpaid fees across the institution.</p>
        </div>
        <div className="flex items-center gap-3">
          <DebtorsExporter schoolName={schoolInfo?.name} filterSummary={filterSummaryString} getExportRows={getExportRows} />
        </div>
      </div>

      {/* Mode Toggle & KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center col-span-1 md:col-span-1">
          <button onClick={() => setMode('parent')} className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${mode === 'parent' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users className="h-4 w-4" /> Families
          </button>
          <button onClick={() => setMode('student')} className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${mode === 'student' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <User className="h-4 w-4" /> Students
          </button>
        </div>

        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm col-span-1 md:col-span-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Debtors (Filtered)</p>
            <p className="text-2xl font-black text-rose-900 mt-1">{totalCount.toLocaleString()} {mode === 'parent' ? 'Families' : 'Students'}</p>
          </div>
          <AlertCircle className="h-8 w-8 text-rose-200" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder={`Search ${mode}s...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
          </div>

          <select value={sessionFilter} onChange={e => { setSessionFilter(e.target.value); setPeriodFilter(''); }} className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium min-w-[150px]">
            <option value="">All-Time (Historical)</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
          </select>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} disabled={!sessionFilter} className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium disabled:opacity-50">
            <option value="">All Terms</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSectionFilter(''); }} className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium min-w-[130px]">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} disabled={!classFilter} className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium disabled:opacity-50">
            <option value="">All Arms</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {(sessionFilter || classFilter || searchQuery) && (
            <button onClick={() => { setSessionFilter(''); setPeriodFilter(''); setClassFilter(''); setSectionFilter(''); setSearchQuery(''); }} className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-colors" title="Clear Filters"><FilterX className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input type="checkbox" className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? data.map(d => d.id) : [])}
                  />
                </th>
                <th className="px-4 py-4">{mode === 'parent' ? 'Family / Sponsor' : 'Student Profile'}</th>
                <th className="px-4 py-4">{mode === 'parent' ? 'Contact' : 'Class / Reg No'}</th>
                <th className="px-4 py-4 text-right">Total Outstanding</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-rose-600 mx-auto" /><p className="text-xs font-medium text-slate-400 mt-2">Loading debtors...</p></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">No outstanding balances found for these filters.</td></tr>
              ) : (
                data.map((row) => {
                  const isChecked = selectedIds.includes(row.id);
                  const toggleCheck = () => setSelectedIds(prev => isChecked ? prev.filter(id => id !== row.id) : [...prev, row.id]);

                  const isParent = mode === 'parent';
                  const name = isParent ? row.__str__ : row.students[0]?.student?.full_name || row.students[0]?.__str__;
                  const secondaryStr = isParent ? (row.mobile || 'No contact') : `${row.students[0]?.registration_number} • ${row.students[0]?.current_class?.name || ''}`;

                  return (
                    <tr key={row.id} className={`transition-colors ${isChecked ? 'bg-rose-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-4 text-center">
                        <input type="checkbox" className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" checked={isChecked} onChange={toggleCheck} />
                      </td>
                      <td className="px-4 py-4 cursor-pointer" onClick={toggleCheck}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isParent ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isParent ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <p className="font-bold text-slate-900 truncate">{name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-medium text-xs cursor-pointer" onClick={toggleCheck}>
                        {secondaryStr}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-rose-600 cursor-pointer" onClick={toggleCheck}>
                        {fmtMoney(row.grand_total_outstanding)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleSingleRemind(row.id); }} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded transition-colors" title="Send Reminder">
                            <Mail className="h-4 w-4" />
                          </button>
                          <button onClick={() => setSelectedLedger(row)} className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1">
                            View <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalCount > PAGE_SIZE && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= totalCount} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DebtorsPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>}>
      <DebtorsContent />
    </Suspense>
  );
}