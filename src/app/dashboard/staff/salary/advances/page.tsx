'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { staffAPI, academicCalendarAPI, salaryAdvancesAPI } from '@/lib/api';
import {
  Banknote, Search, X, Check, AlertCircle, AlertTriangle, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, UserCircle, CalendarDays,
  Wallet, XCircle, Plus, Eye, FileText, Printer, Building2
} from 'lucide-react';

// ─── Constants & Helpers ───────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const now = new Date();
const currentMonth = String(now.getMonth() + 1);
const currentYear = String(now.getFullYear());

const MONTHS = [
  { value: '', label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('default', { month: 'long' }) }))
];
const YEARS = [
  { value: '', label: 'All Years' },
  ...Array.from({ length: 5 }, (_, i) => ({ value: String(now.getFullYear() - 2 + i), label: String(now.getFullYear() - 2 + i) }))
];

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

function fmtMoney(amount: string | number | null | undefined): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unwrapList(res: any): any[] {
  const data = res?.results?.data ?? res?.data?.results ?? res?.data ?? res?.results ?? res;
  return Array.isArray(data) ? data : (Array.isArray(res) ? res : []);
}

function getImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string, pill: string, text: string }> = {
  pending: { label: 'Pending', pill: 'bg-amber-100 text-amber-700 border-amber-200', text: 'text-amber-600' },
  approved: { label: 'Approved', pill: 'bg-blue-100 text-blue-700 border-blue-200', text: 'text-blue-600' },
  disbursed: { label: 'Disbursed', pill: 'bg-indigo-100 text-indigo-700 border-indigo-200', text: 'text-indigo-600' },
  completed: { label: 'Completed', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-600' },
  rejected: { label: 'Rejected', pill: 'bg-rose-100 text-rose-700 border-rose-200', text: 'text-rose-600' },
};

// ─── UI Components ─────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${t.type === 'success' ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-white border-rose-200 text-rose-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-500" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-40 hover:opacity-80 flex-shrink-0 ml-1"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ConfirmActionModal({ open, title, message, actionText, isProcessing, onConfirm, onCancel, colorCls = 'bg-blue-600 hover:bg-blue-700' }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-5 w-5 text-slate-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={isProcessing} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm ${colorCls}`}>
            {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : actionText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Advance Detail Drawer ─────────────────────────────────────────────────────
function AdvanceDetailDrawer({ advanceId, onClose }: { advanceId: number | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (advanceId) {
      setLoading(true);
      salaryAdvancesAPI.get(advanceId)
        .then(res => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [advanceId]);

  if (!advanceId) return null;
  const staff = data?.staff_detail || null;
  const statusInfo = STATUS_CONFIG[data?.status || 'pending'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col animate-in slide-in-from-right">
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : data ? (
          <>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">Advance Details</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Requested Amount</p>
              <p className="text-3xl font-black text-white mb-3">{fmtMoney(data.amount)}</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusInfo.pill}`}>
                  {statusInfo.label}
                </span>
                {data.status === 'disbursed' && (
                  <span className="px-2.5 py-1 bg-white/10 text-white rounded-full text-[11px] font-bold border border-white/20">
                    Bal: {fmtMoney(data.balance)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5 flex-1 bg-slate-50/50">
              {/* Staff Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Staff Profile</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                    {staff ? `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}` : <UserCircle className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{staff?.full_name || data.staff_name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{staff?.staff_id || 'Unknown ID'}</p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Provided Reason</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.reason}</p>
              </div>

              {/* Audit Trail */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Audit Trail</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Requested On</span>
                    <span className="font-semibold text-slate-800">{new Date(data.request_date).toLocaleDateString()}</span>
                  </div>
                  {data.approved_date && (
                    <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Approved On</span>
                      <span className="font-semibold text-blue-600">{new Date(data.approved_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {data.status === 'completed' && (
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-slate-500">Fully Repaid</span>
                      <span className="font-semibold text-emerald-600">Yes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-rose-500 text-sm">Failed to load details.</div>
        )}
      </div>
    </div>
  );
}

// ─── Request Advance Modal ─────────────────────────────────────────────────────
function RequestAdvanceModal({ isSaving, currentPeriodId, onSave, onClose }: any) {
  const [form, setForm] = useState({
    staff: '',
    amount: '',
    reason: '',
    request_date: new Date().toISOString().split('T')[0]
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<any[]>([]);
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!staffSearch) { setStaffResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await staffAPI.list({ search: staffSearch, page_size: 10, is_active: true }) as any;
        setStaffResults(unwrapList(res));
      } catch { setStaffResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [staffSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowStaffDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.staff) return setFormError('Please select a staff member.');
    try {
      await onSave({
        staff: Number(form.staff),
        amount: form.amount,
        reason: form.reason,
        request_date: form.request_date,
        academic_period: currentPeriodId,
      });
    } catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200"><Banknote className="h-4 w-4 text-white" /></div>
            <h3 className="text-base font-bold text-slate-900">Request Salary Advance</h3>
          </div>
          <button onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-rose-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="advance-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div ref={searchRef}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Staff member <span className="text-rose-400 normal-case">*</span></label>
            <div className="relative">
              <input type="text" placeholder="Search by name or ID..." value={staffSearch}
                onChange={e => { setStaffSearch(e.target.value); setShowStaffDrop(true); setForm(f => ({ ...f, staff: '' })); }}
                onFocus={() => setShowStaffDrop(true)} className={inputCls + ' pr-10'} required={!form.staff} />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
              {showStaffDrop && staffResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {staffResults.map(s => (
                    <button key={s.id} type="button"
                      onClick={() => { setForm(f => ({ ...f, staff: String(s.id) })); setStaffSearch(s.full_name || `${s.first_name} ${s.last_name}`); setShowStaffDrop(false); }}
                      className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><UserCircle className="h-4 w-4 text-blue-400" /></div>
                      <div><p className="text-sm font-bold text-slate-800">{s.full_name || `${s.first_name} ${s.last_name}`}</p><p className="text-xs text-slate-400 font-mono">{s.staff_id || `ID: ${s.id}`}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₦) <span className="text-rose-400 normal-case">*</span></label>
              <input type="number" step="0.01" min="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Request Date <span className="text-rose-400 normal-case">*</span></label>
              <input type="date" required value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Reason <span className="text-rose-400 normal-case">*</span></label>
            <textarea required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Provide a detailed reason..." className={inputCls + ' resize-none'} />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
          <button type="submit" form="advance-form" disabled={isSaving} className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Submit Request</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalaryAdvancesPage() {
  const { hasPermission, user, schoolInfo } = useAuth();

  const [advances, setAdvances] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // ── Dual Filter Mode ──
  const [filterMode, setFilterMode] = useState<'month' | 'period'>('month');

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modals & Drawers ──
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; action: 'approve' | 'reject' | 'disburse'; id: number | null }>({ open: false, title: '', message: '', action: 'approve', id: null });
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [isPrinting, setIsPrinting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('salary_management.add_salaryadvancemodel');
  const canApprove = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Lookups ──
  useEffect(() => {
    academicCalendarAPI.listSessions().then(res => setSessions(unwrapList(res))).catch(() => {});
    academicCalendarAPI.listSessionPeriods({ is_current: true, page_size: 1 } as any).then((data: any) => {
      const list = unwrapList(data);
      if (list.length > 0) setCurrentPeriodId(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) { setPeriods([]); setSelectedPeriod(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSession) }).then(res => setPeriods(unwrapList(res))).catch(() => setPeriods([]));
  }, [selectedSession]);

  // Handle Mode Switch
  useEffect(() => {
    if (filterMode === 'month') { setSelectedSession(''); setSelectedPeriod(''); }
    else { setMonth(''); setYear(''); }
  }, [filterMode]);

  // ── Fetch ──
  const fetchData = useCallback(async (pg = 1, fetchAllForPrint = false) => {
    if (!fetchAllForPrint) { setLoading(true); setPageError(null); }
    try {
      const params: Record<string, any> = { page: pg, page_size: fetchAllForPrint ? 1000 : PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      if (filterMode === 'month') {
        if (month) params.month = month;
        if (year) params.year = year;
      } else {
        if (selectedPeriod) params.academic_period = selectedPeriod;
        else if (selectedSession) params.session = selectedSession;
      }

      const res = await salaryAdvancesAPI.list(params) as any;

      if (fetchAllForPrint) return unwrapList(res);

      setAdvances(unwrapList(res));
      setTotal(res.count ?? res.data?.count ?? res.results?.count ?? 0);
      setPage(pg);
    } catch (err) {
      if (!fetchAllForPrint) setPageError(extractError(err));
    } finally {
      if (!fetchAllForPrint) setLoading(false);
    }
  }, [statusFilter, selectedSession, selectedPeriod, search, month, year, filterMode]);

  useEffect(() => { fetchData(1); }, [statusFilter, selectedSession, selectedPeriod, month, year, filterMode, fetchData]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchData(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, fetchData]);

  // ── Print Logic ──
  useEffect(() => {
    if (!isPrinting) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsPrinting(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrinting]);

  const [printData, setPrintData] = useState<any[]>([]);
  const triggerPrint = async () => {
    setLoading(true);
    const data = await fetchData(1, true);
    setPrintData(data || []);
    setLoading(false);
    setIsPrinting(true);
  };

  // ── Actions ──
  const handleSaveAdvance = async (payload: any) => {
    setIsSaving(true);
    try {
      await salaryAdvancesAPI.create(payload);
      showToast('success', 'Salary advance requested successfully');
      setShowCreate(false);
      fetchData(1);
    } catch (err) { throw err; } finally { setIsSaving(false); }
  };

  const processAction = async () => {
    if (!actionModal.id) return;
    setIsProcessingAction(true);
    try {
      await salaryAdvancesAPI.action(actionModal.id, { action: actionModal.action as any });
      showToast('success', `Advance ${actionModal.action}d successfully`);
      setActionModal({ ...actionModal, open: false });
      fetchData(page);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsProcessingAction(false); }
  };

  // ── Stats ──
  const pendingCount = advances.filter(a => a.status === 'pending').length;
  const totalDisbursed = advances.filter(a => a.status === 'disbursed').reduce((s, a) => s + parseFloat(a.balance || a.amount), 0);
  const totalRecovered = advances.filter(a => a.status === 'completed').reduce((s, a) => s + parseFloat(a.amount), 0);

  const selectCls = "px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all";

  const getFilterString = () => {
    const str = [];
    if (filterMode === 'month') {
      if (month) str.push(`Month: ${MONTHS.find(m => m.value === month)?.label}`);
      if (year) str.push(`Year: ${year}`);
    } else {
      if (selectedSession) str.push(`Session: ${sessions.find(s => String(s.id) === selectedSession)?.start_year}/${sessions.find(s => String(s.id) === selectedSession)?.end_year}`);
      if (selectedPeriod) str.push(`Term: ${periods.find(p => String(p.id) === selectedPeriod)?.period?.name}`);
    }
    if (statusFilter) str.push(`Status: ${STATUS_CONFIG[statusFilter]?.label}`);
    return str.join(' • ') || 'All Records';
  };

  return (
    <div className="space-y-6 pb-10">

      {/* Print CSS constraints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <AdvanceDetailDrawer advanceId={detailId} onClose={() => setDetailId(null)} />

      <ConfirmActionModal
        open={actionModal.open} title={actionModal.title} message={actionModal.message}
        actionText={actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)}
        colorCls={actionModal.action === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : actionModal.action === 'approve' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}
        isProcessing={isProcessingAction} onConfirm={processAction} onCancel={() => setActionModal({ ...actionModal, open: false })}
      />

      {showCreate && <RequestAdvanceModal isSaving={isSaving} currentPeriodId={currentPeriodId} onSave={handleSaveAdvance} onClose={() => setShowCreate(false)} />}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 flex-shrink-0">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Salary Advances</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage short-term salary deductions</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={triggerPrint} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print List
          </button>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Request Advance
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Approval', value: pendingCount, iconBg: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-500', icon: AlertCircle },
          { label: 'Total Disbursed', value: fmtMoney(totalDisbursed), iconBg: 'bg-indigo-50 border-indigo-100', iconColor: 'text-indigo-500', icon: Wallet },
          { label: 'Total Recovered', value: fmtMoney(totalRecovered), iconBg: 'bg-emerald-50 border-emerald-100', iconColor: 'text-emerald-500', icon: Check },
          { label: 'Total Requests', value: total, iconBg: 'bg-blue-50 border-blue-100', iconColor: 'text-blue-500', icon: Banknote },
        ].map(({ label, value, iconBg, iconColor, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 border rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</p>
              <p className="text-lg font-black text-slate-800 tabular-nums truncate">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">

            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input type="text" placeholder="Search by staff name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white shadow-sm" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
            </div>

            {/* Mode & Dropdowns */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Dual Filter Toggle */}
              <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200">
                <button onClick={() => setFilterMode('month')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>By Month</button>
                <button onClick={() => setFilterMode('period')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'period' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>By Term</button>
              </div>

              {filterMode === 'month' ? (
                <>
                  <select value={month} onChange={e => setMonth(e.target.value)} className={selectCls}>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select value={year} onChange={e => setYear(e.target.value)} className={selectCls}>
                    {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <select value={selectedSession} onChange={e => { setSelectedSession(e.target.value); setSelectedPeriod(''); }} className={selectCls}>
                    <option value="">All Sessions</option>
                    {sessions.map((s: any) => <option key={s.id} value={String(s.id)}>{s.start_year}/{s.end_year}</option>)}
                  </select>
                  <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} disabled={!selectedSession} className={selectCls + ' disabled:opacity-40 disabled:cursor-not-allowed'}>
                    <option value="">All Terms</option>
                    {periods.map((p: any) => <option key={p.id} value={String(p.id)}>{p.period?.name || `Period ${p.id}`}</option>)}
                  </select>
                </>
              )}

              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="disbursed">Disbursed</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <button onClick={() => fetchData(page)} className="p-2.5 rounded-xl border border-slate-200 text-slate-400 bg-white hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" /><p className="mt-3 text-sm font-medium text-slate-400">Loading advances...</p></div>
        ) : pageError ? (
          <div className="p-16 text-center"><AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-3" /><p className="text-sm font-medium text-rose-600 mb-4">{pageError}</p><button onClick={() => fetchData(1)} className="text-sm text-blue-600 font-bold hover:underline inline-flex items-center gap-1.5"><RefreshCw className="h-4 w-4" /> Retry</button></div>
        ) : advances.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5"><Banknote className="h-8 w-8 text-blue-400" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No advances found</h3>
            <p className="text-sm text-slate-500">There are no salary advance records matching your current filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '950px' }}>
                <colgroup>
                  <col style={{ width: '250px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '150px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Staff Profile</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">Amount & Bal</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Reason</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-5 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {advances.map(adv => (
                    <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-500"><UserCircle className="h-5 w-5" /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{adv.staff_name || 'Unknown'}</p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">{adv.staff_detail?.staff_id || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-[15px] font-black text-slate-800 tabular-nums">{fmtMoney(adv.amount)}</p>
                        <p className="text-[11px] font-bold text-rose-500 tabular-nums mt-0.5">Bal: {fmtMoney(adv.balance)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-medium text-slate-500 truncate" title={adv.reason}>{adv.reason}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold text-slate-600">{new Date(adv.request_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${STATUS_CONFIG[adv.status]?.pill || 'bg-slate-100 text-slate-500'}`}>
                          {STATUS_CONFIG[adv.status]?.label || adv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setDetailId(adv.id)} title="View Details" className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"><Eye className="h-4 w-4"/></button>

                          {canApprove && adv.status === 'pending' && (
                            <>
                              <button onClick={() => setActionModal({ open: true, title: 'Approve Advance', message: `Approve ${fmtMoney(adv.amount)} for ${adv.staff_name}?`, action: 'approve', id: adv.id })} className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="Approve"><Check className="w-4 h-4"/></button>
                              <button onClick={() => setActionModal({ open: true, title: 'Reject Advance', message: `Are you sure you want to reject this advance?`, action: 'reject', id: adv.id })} className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors" title="Reject"><XCircle className="w-4 h-4"/></button>
                            </>
                          )}

                          {canApprove && adv.status === 'approved' && (
                            <button onClick={() => setActionModal({ open: true, title: 'Disburse Funds', message: `Confirm ${fmtMoney(adv.amount)} has been disbursed to ${adv.staff_name}? It will now be tracked for auto-deduction.`, action: 'disburse', id: adv.id })} className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center gap-1.5 text-xs font-bold hover:bg-indigo-100 transition-colors"><Wallet className="w-3.5 h-3.5"/> Disburse</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
              <p className="text-xs text-slate-400">Showing <span className="font-semibold text-slate-600">{advances.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)}</span> of <span className="font-bold text-slate-700">{total}</span> records</p>
              {Math.ceil(total / PAGE_SIZE) > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => fetchData(page - 1)} disabled={page === 1} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => fetchData(page + 1)} disabled={page === Math.ceil(total / PAGE_SIZE)} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── IN-DOM PRINT OVERLAY ── */}
      {isPrinting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setIsPrinting(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-colors"><Printer className="w-3.5 h-3.5" /> Print Document</button>
            </div>

            <div className="p-8 print:p-0 text-slate-900 print:text-black">
              {/* Letterhead */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-8 w-8 text-slate-400" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[12px] font-medium text-slate-600 truncate">{schoolInfo?.address || 'Address not configured'}</p>
                  <p className="text-[12px] font-medium text-slate-600">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' • ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Report</p>
                  <span className="text-[12px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 whitespace-nowrap">
                    Salary Advances
                  </span>
                </div>
              </div>

              {/* Meta Data */}
              <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Filters Applied</p>
                <p className="text-sm font-semibold text-slate-800">{getFilterString()}</p>
              </div>

              {/* Print Table */}
              <div className="mb-8 break-inside-avoid">
                <table className="w-full text-sm border-collapse border border-slate-300">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 px-4 py-2 text-center font-bold text-slate-800 uppercase text-[11px] tracking-wider w-12">S/N</th>
                      <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-800 uppercase text-[11px] tracking-wider">Staff Name</th>
                      <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-800 uppercase text-[11px] tracking-wider">Status</th>
                      <th className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-800 uppercase text-[11px] tracking-wider w-32">Amount</th>
                      <th className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-800 uppercase text-[11px] tracking-wider w-32">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.map((adv, i) => (
                      <tr key={adv.id}>
                        <td className="border border-slate-300 px-4 py-2 text-center text-slate-600">{i + 1}</td>
                        <td className="border border-slate-300 px-4 py-2 font-medium text-slate-800">{adv.staff_name}</td>
                        <td className="border border-slate-300 px-4 py-2 font-medium text-slate-800 uppercase text-[10px]">{adv.status}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-900 tabular-nums">{fmtMoney(adv.amount)}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right font-bold text-rose-600 tabular-nums">{fmtMoney(adv.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {printData.length === 0 && (
                    <tr><td colSpan={5} className="border border-slate-300 px-4 py-4 text-center text-slate-500">No records found.</td></tr>
                  )}
                </table>
              </div>

              <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t-2 border-slate-200 pt-4">
                This is a computer-generated report. <br />
                <span className="mt-1 block text-slate-500">Generated: {now.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}