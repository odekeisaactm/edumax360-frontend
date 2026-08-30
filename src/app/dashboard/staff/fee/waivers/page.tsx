'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, studentsAPI, academicCalendarAPI } from '@/lib/api';
import WaiverCopyWizard from '@/components/fee/WaiverCopy';
import {
  Award, Clock, CheckCircle2, XCircle, Eye, X, Loader2, RotateCcw, Edit3,
  AlertCircle, Search, Check, Plus, GraduationCap, ArrowLeft, ExternalLink, Copy
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
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join(' ');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function stripGroupSuffix(description: string): string {
  return (description || '').split(' — ')[0];
}

function summarizeItems(items: any[]): string {
  if (!items || items.length === 0) return 'Fee Item';
  const names = items.map(i => toTitleCase(stripGroupSuffix(i.item_description || 'Fee Item')));
  if (names.length === 1) return names[0];
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`;
}

function getUniqueInvoiceLinks(items: any[] = []): { id: number; type: 'student' | 'family' }[] {
  const map = new Map<number, { id: number; type: 'student' | 'family' }>();
  for (const it of items) {
    if (it.invoice_id) {
      map.set(it.invoice_id, { id: it.invoice_id, type: it.invoice_type || 'student' });
    }
  }
  return Array.from(map.values());
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border sm:max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2" aria-label="Dismiss notification">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Modal Dialogs ─────────────────────────────────────────────────────
function ConfirmActionModal({ open, title, message, onConfirm, onCancel, loading }: any) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 transition-colors">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({ open, title, icon, actionText, actionColor, onConfirm, onCancel, loading }: any) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const btnColor = actionColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200';
  const headerColor = actionColor === 'rose' ? 'text-rose-600' : 'text-amber-600';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-4 text-left">
        <div className={`flex items-center gap-2 font-bold text-base ${headerColor}`}>
          {icon} {title}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">Please state the exact reason for this action to maintain ledger integrity.</p>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reason <span className="text-rose-500">*</span></label>
          <textarea
            ref={textareaRef}
            rows={3}
            placeholder="Provide clear reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 outline-none text-slate-800"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={loading || !reason.trim()} className={`px-5 py-2 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors ${btnColor}`}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { label: 'Rejected', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle className="h-3 w-3" /> },
    reversed: { label: 'Reversed', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <RotateCcw className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Main Waivers Page ────────────────────────────────────────────────────────
function WaiversContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const canManageWaivers = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const deepLinkStudentId = searchParams.get('student_id');
  const returnTo = searchParams.get('return_to');
  const returnStudentId = searchParams.get('return_student_id');

  const [waivers, setWaivers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending_count: 0, total_approved_amount: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  // Pagination (Fixed at 20 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Drawer / Audit Details
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit / Reversal State
  const [isEditingWaiver, setIsEditingWaiver] = useState(false);
  const [waiverEdits, setWaiverEdits] = useState<Record<number, string>>({});

  // Modals
  const [approveModal, setApproveModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [reverseModal, setReverseModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });

  // New Waiver Drawer State
  const [isNewWaiverOpen, setIsNewWaiverOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [includeInactiveStudents, setIncludeInactiveStudents] = useState(false);

  // Bulk Waiver Copy Wizard
  const [isCopyWizardOpen, setIsCopyWizardOpen] = useState(false);

  const [waivableItems, setWaivableItems] = useState<any[]>([]);
  const [loadingWaivables, setLoadingWaivables] = useState(false);
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);

  const [waiverSelections, setWaiverSelections] = useState<Record<string, { id: number; type: string; amount: string; max: number; description: string; group: string }>>({});
  const [globalReason, setGlobalReason] = useState('');
  const [confirmBulkModal, setConfirmModal] = useState(false);

  const requestIdRef = useRef(0);
  const studentSearchRef = useRef<HTMLDivElement>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const goBackToOrigin = useCallback(() => {
    if (returnTo) {
      const url = returnStudentId ? `${returnTo}?student_id=${returnStudentId}` : returnTo;
      router.push(url);
    } else {
      setIsNewWaiverOpen(false);
    }
  }, [returnTo, returnStudentId, router]);

  useEffect(() => {
    const anyOverlayOpen = isNewWaiverOpen || isDrawerOpen || confirmBulkModal || approveModal.open || rejectModal.open || reverseModal.open || isCopyWizardOpen;
    if (anyOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isNewWaiverOpen, isDrawerOpen, confirmBulkModal, approveModal.open, rejectModal.open, reverseModal.open, isCopyWizardOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmBulkModal) setConfirmModal(false);
      else if (approveModal.open) setApproveModal({ open: false, item: null });
      else if (rejectModal.open) setRejectModal({ open: false, item: null });
      else if (reverseModal.open) setReverseModal({ open: false, item: null });
      else if (isDrawerOpen) setIsDrawerOpen(false);
      else if (isNewWaiverOpen) closeNewWaiverDrawer();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmBulkModal, approveModal.open, rejectModal.open, reverseModal.open, isDrawerOpen, isNewWaiverOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) {
      setIsEditingWaiver(false);
      setWaiverEdits({});
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    academicCalendarAPI.listSessions()
      .then(sess => setSessions(Array.isArray(sess) ? sess : []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (sessionFilter) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionFilter) })
        .then(pers => setPeriods(Array.isArray(pers) ? pers : []))
        .catch(() => setPeriods([]));
    } else {
      setPeriods([]);
      setPeriodFilter('');
    }
  }, [sessionFilter]);

  const fetchWaiversAndStats = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params: any = { page: currentPage, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (sessionFilter) params.session = sessionFilter;
      if (periodFilter) params.period = periodFilter;

      const listRes = await feeAPI.getWaivers(params);

      if (requestId !== requestIdRef.current) return;

      let results: any[] = [];
      let count = 0;
      if (Array.isArray(listRes)) {
        results = listRes;
        count = listRes.length;
      } else if ((listRes as any)?.results) {
        results = (listRes as any).results;
        count = (listRes as any).count ?? results.length;
      }

      const pending = results.filter((g: any) => g.status === 'pending').length;
      const approvedTotal = results
        .filter((g: any) => g.status === 'approved')
        .reduce((sum: number, g: any) => sum + g.items.reduce((s: number, i: any) => s + parseFloat(i.amount_waived || 0), 0), 0);

      setWaivers(results);
      setTotalCount(count);
      setStats({ pending_count: pending, total_approved_amount: approvedTotal });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      showToast('error', extractError(error));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [statusFilter, sessionFilter, periodFilter, currentPage, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchWaiversAndStats(); }, 200);
    return () => clearTimeout(timer);
  }, [fetchWaiversAndStats]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, sessionFilter, periodFilter]);

  const loadWaivableItemsFor = useCallback(async (student: any) => {
    setSelectedStudent(student);
    setStudentSearchQuery('');
    setStudentSearchResults([]);
    setShowSearchDropdown(false);
    setWaiverSelections({});
    setLoadingWaivables(true);
    try {
      const res = await feeAPI.getWaivableItems(student.id);
      setWaivableItems(Array.isArray(res) ? res : res?.items || []);
    } catch (err: any) {
      showToast('error', extractError(err));
      setWaivableItems([]);
    } finally {
      setLoadingWaivables(false);
    }
  }, []);

  useEffect(() => {
    if (!deepLinkStudentId) return;
    let cancelled = false;
    setDeepLinkLoading(true);
    setIsNewWaiverOpen(true);
    (async () => {
      try {
        const student = await studentsAPI.get(deepLinkStudentId);
        if (cancelled) return;
        const st = student?.data ?? student;
        await loadWaivableItemsFor(st);
      } catch (err: any) {
        if (!cancelled) showToast('error', 'Could not load the selected student.');
      } finally {
        if (cancelled) return;
        setDeepLinkLoading(false);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('student_id');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    })();
    return () => { cancelled = true; };
  }, [deepLinkStudentId]);

  useEffect(() => {
    if (!studentSearchQuery.trim()) {
      setStudentSearchResults([]);
      setIsSearchingStudents(false);
      return;
    }
    setIsSearchingStudents(true);
    const timer = setTimeout(async () => {
      try {
        const res = await studentsAPI.list({
          search: studentSearchQuery.trim(),
          status: includeInactiveStudents ? undefined : 'active',
          page_size: 10
        });
        const data = res?.results ?? res?.data ?? res ?? [];
        setStudentSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Student search failed", err);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchQuery, includeInactiveStudents]);

  const handleToggleWaivableItem = (item: any) => {
    setWaiverSelections(prev => {
      const copy = { ...prev };
      if (copy[item.id]) {
        delete copy[item.id];
      } else {
        copy[item.id] = { id: item.id, type: item.type, amount: item.balance, max: parseFloat(item.balance), description: item.description, group: item.group_label };
      }
      return copy;
    });
  };

  const toggleSelectAllInGroup = (items: any[]) => {
    setWaiverSelections(prev => {
      const copy = { ...prev };
      const allSelected = items.every((it: any) => !!copy[it.id]);
      if (allSelected) {
        items.forEach((it: any) => { delete copy[it.id]; });
      } else {
        items.forEach((it: any) => {
          if (!copy[it.id]) {
            copy[it.id] = { id: it.id, type: it.type, amount: it.balance, max: parseFloat(it.balance), description: it.description, group: it.group_label };
          }
        });
      }
      return copy;
    });
  };

  const handleUpdateWaiverAmount = (id: number, val: string) => {
    setWaiverSelections(prev => {
      if (!prev[id]) return prev;
      const num = parseFloat(val);
      const max = prev[id].max;
      const clamped = isNaN(num) ? '' : Math.min(num, max).toString();
      return { ...prev, [id]: { ...prev[id], amount: clamped } };
    });
  };

  const validSelections = Object.values(waiverSelections).filter(
    sel => sel.amount !== '' && !isNaN(parseFloat(sel.amount)) && parseFloat(sel.amount) > 0
  );
  const hasInvalidSelections = Object.keys(waiverSelections).length > validSelections.length;

  const closeNewWaiverDrawer = useCallback(() => {
    setIsNewWaiverOpen(false);
    setSelectedStudent(null);
    setWaivableItems([]);
    setWaiverSelections({});
    setGlobalReason('');
    if (returnTo) goBackToOrigin();
  }, [returnTo, goBackToOrigin]);

  const handleBulkSubmit = async () => {
    setActionLoading(true);
    try {
      const requests = validSelections.map(sel => ({
        invoice_item_id: sel.type === 'invoice_item_id' ? sel.id : null,
        family_invoice_item_id: sel.type === 'family_invoice_item_id' ? sel.id : null,
        other_payment_id: sel.type === 'other_payment_id' ? sel.id : null,
        amount_waived: sel.amount,
        reason: globalReason.trim()
      }));

      await feeAPI.bulkCreateWaivers({ requests, global_reason: globalReason.trim() });
      showToast('success', 'Waiver requests successfully submitted!');
      setConfirmModal(false);
      closeNewWaiverDrawer();
      fetchWaiversAndStats();
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const patchWaiverGroup = useCallback((reference: string, patch: Partial<any>) => {
    setWaivers(prev => {
      const idx = prev.findIndex(g => g.reference === reference);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      if (statusFilter && updated.status !== statusFilter) {
        fetchWaiversAndStats();
        return prev.filter(g => g.reference !== reference);
      }
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setSelectedGroup((prev: any) => (prev && prev.reference === reference ? { ...prev, ...patch } : prev));
  }, [statusFilter, fetchWaiversAndStats]);

  const handleApproveSubmit = async () => {
    if (!approveModal.item) return;
    setActionLoading(true);
    try {
      const ids = approveModal.item.items.map((i: any) => i.id);
      await feeAPI.bulkApproveWaivers(ids);
      showToast('success', `${ids.length > 1 ? 'Waiver bundle' : 'Waiver'} approved successfully.`);
      patchWaiverGroup(approveModal.item.reference, { status: 'approved' });
      setApproveModal({ open: false, item: null });
      setIsDrawerOpen(false);
      fetchWaiversAndStats();
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectModal.item) return;
    setActionLoading(true);
    try {
      const ids = rejectModal.item.items.map((i: any) => i.id);
      await feeAPI.bulkRejectWaivers(ids, reason);
      showToast('success', `${ids.length > 1 ? 'Waiver bundle' : 'Waiver'} rejected.`);
      patchWaiverGroup(rejectModal.item.reference, { status: 'rejected', rejection_reason: reason });
      setRejectModal({ open: false, item: null });
      setIsDrawerOpen(false);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverseSubmit = async (reason: string) => {
    if (!reverseModal.item) return;
    setActionLoading(true);
    try {
      const ids = reverseModal.item.items.map((i: any) => i.id);
      await feeAPI.bulkReverseWaivers({ ids, reason });
      showToast('success', 'Waiver successfully reversed and ledger balances restored.');
      patchWaiverGroup(reverseModal.item.reference, {
        status: 'reversed',
        rejection_reason: `Reversed: ${reason}`
      });
      setReverseModal({ open: false, item: null });
      setIsDrawerOpen(false);
      fetchWaiversAndStats();
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCorrections = async () => {
    setActionLoading(true);
    try {
      const updates = Object.entries(waiverEdits).map(([id, amount]) => ({
        id: Number(id),
        amount_waived: amount || "0.00"
      }));
      await feeAPI.bulkAdjustWaivers({ updates });
      showToast('success', 'Waiver amounts successfully corrected.');
      setIsEditingWaiver(false);
      setIsDrawerOpen(false);
      fetchWaiversAndStats();
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Enters edit mode with each item's current waived amount pre-filled.
  // No client-side ceiling here — the backend validates the amount against
  // the item's real outstanding balance and rejects anything over it.
  const handleStartEditing = useCallback(() => {
    if (!selectedGroup) return;
    const initials: Record<number, string> = {};
    selectedGroup.items.forEach((it: any) => {
      initials[it.id] = parseFloat(it.amount_waived || '0').toString();
    });
    setWaiverEdits(initials);
    setIsEditingWaiver(true);
  }, [selectedGroup]);

  const groupedWaivableItems = waivableItems.reduce((acc: any[], item: any) => {
    let group = acc.find(g => g.label === item.group_label);
    if (!group) {
      group = { label: item.group_label, items: [] };
      acc.push(group);
    }
    group.items.push(item);
    return acc;
  }, []);

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* CONFIRMATION & REASON MODALS */}
      <ConfirmActionModal
        open={approveModal.open}
        title="Approve Waiver"
        message={
          approveModal.item?.items?.length > 1
            ? `Are you sure you want to approve all ${approveModal.item.items.length} items in this waiver bundle?`
            : `Are you sure you want to approve this waiver request?`
        }
        onConfirm={handleApproveSubmit}
        onCancel={() => setApproveModal({ open: false, item: null })}
        loading={actionLoading}
      />

      <ReasonModal
        open={rejectModal.open}
        title="Reject Waiver"
        icon={<AlertCircle className="h-5 w-5" />}
        actionText="Confirm Rejection"
        actionColor="rose"
        onConfirm={handleRejectSubmit}
        onCancel={() => setRejectModal({ open: false, item: null })}
        loading={actionLoading}
      />

      <ReasonModal
        open={reverseModal.open}
        title="Reverse Waiver"
        icon={<RotateCcw className="h-5 w-5" />}
        actionText="Confirm Reversal"
        actionColor="rose"
        onConfirm={handleReverseSubmit}
        onCancel={() => setReverseModal({ open: false, item: null })}
        loading={actionLoading}
      />

      {/* BULK CONFIRMATION MODAL */}
      {confirmBulkModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 text-left animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Award className="h-5 w-5" />
              </div>
              Confirm Waiver Requests
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              You are about to submit <strong className="text-slate-800">{validSelections.length}</strong> waiver item(s) for <strong className="text-slate-800">{selectedStudent?.first_name} {selectedStudent?.last_name}</strong> totaling <strong className="text-slate-900">{fmtMoney(validSelections.reduce((s, x) => s + parseFloat(x.amount || 0), 0))}</strong>.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 p-3 rounded-2xl bg-slate-50 text-xs">
              {validSelections.map((sel: any) => (
                <div key={sel.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-medium text-slate-700">{toTitleCase(sel.description)} ({sel.group})</span>
                  <strong className="text-emerald-700">{fmtMoney(parseFloat(sel.amount))}</strong>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmModal(false)} disabled={actionLoading} className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleBulkSubmit} disabled={actionLoading} className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-colors">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <Award className="h-5 w-5 text-white" />
            </div>
            Fee Waivers & Concessions
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 pl-12">Manage institutional student fee waivers and balance concessions.</p>
        </div>
        {canManageWaivers && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsCopyWizardOpen(true)}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm w-full sm:w-auto whitespace-nowrap"
            >
              <Copy className="h-4 w-4" />
              Bulk Copy
            </button>
            <button
              onClick={() => setIsNewWaiverOpen(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-md shadow-emerald-200 text-sm w-full sm:w-auto whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              New Waiver
            </button>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Approved Value</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 truncate">{fmtMoney(stats.total_approved_amount)}</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
          className={`bg-white border cursor-pointer rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 transition-all ${
            statusFilter === 'pending' ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100 hover:border-amber-300'
          }`}
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.pending_count}</p>
              <span className="text-xs font-semibold text-amber-600 mb-1">
                {statusFilter === 'pending' ? 'Viewing pending' : 'Click to filter & review'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Academic Sessions</option>
          {sessions.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>
          ))}
        </select>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          disabled={!sessionFilter}
          className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:opacity-50"
        >
          <option value="">All Terms / Periods</option>
          {periods.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 sm:px-5 py-3 sm:py-4">Student</th>
                <th className="px-3 sm:px-5 py-3 sm:py-4 min-w-[180px] sm:min-w-[220px]">Items</th>
                <th className="px-3 sm:px-5 py-3 sm:py-4 text-right">Total Waived</th>
                <th className="px-3 sm:px-5 py-3 sm:py-4 text-center hidden sm:table-cell">Status</th>
                <th className="px-3 sm:px-5 py-3 sm:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-xs font-semibold">Loading waivers...</p>
                  </td>
                </tr>
              ) : waivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 font-medium">No waivers found.</td>
                </tr>
              ) : (
                waivers.map((group) => {
                  const isPending = group.status === 'pending';
                  const totalGroupAmount = group.items.reduce((s: number, i: any) => s + parseFloat(i.amount_waived || 0), 0);
                  const studentName = toTitleCase(group.student_name || 'Student');

                  return (
                    <tr key={group.reference} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <div className="flex items-center gap-3">
                          {group.student_image_url ? (
                            <img src={getImageUrl(group.student_image_url)} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                              <GraduationCap className="h-4 w-4 text-emerald-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{studentName}</p>
                            <p className="text-[10px] font-mono text-slate-500 uppercase truncate">{group.student_reg_no}</p>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 whitespace-nowrap">
                              {group.student_class}
                            </span>
                            <div className="sm:hidden mt-1">
                              <StatusBadge status={group.status} />
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <p className="font-bold text-slate-800 truncate max-w-[140px] sm:max-w-none">{summarizeItems(group.items)}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[140px] sm:max-w-xs">{group.reason || 'No reason provided'}</p>
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {fmtMoney(totalGroupAmount)}
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-center hidden sm:table-cell">
                        <StatusBadge status={group.status} />
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {isPending && canManageWaivers && (
                            <>
                              <button onClick={() => setApproveModal({ open: true, item: group })} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Approve">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setRejectModal({ open: true, item: group })} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Reject">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => { setSelectedGroup(group); setIsDrawerOpen(true); }} className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors shadow-2xs" title="View Details">
                            <Eye className="w-4 h-4" />
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

        {/* FIXED PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="px-3 sm:px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Page {currentPage} of {totalPages} · {totalCount} total records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl shadow-2xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl shadow-2xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── NEW WAIVER REQUEST SLIDE-OVER DRAWER ────────────────────────── */}
      {isNewWaiverOpen && (
        <div onClick={closeNewWaiverDrawer} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {returnTo && (
                  <button onClick={goBackToOrigin} className="p-1.5 -ml-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors" aria-label="Back to Debtors">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h3 className="text-base font-bold">Request Fee Waiver</h3>
              </div>
              <button onClick={closeNewWaiverDrawer} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {deepLinkLoading && (
                <div className="py-10 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs font-semibold">Loading student's outstanding balances...</p>
                </div>
              )}

              {/* Step 1: Student Search */}
              {!deepLinkLoading && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">1. Select Student</label>
                {!selectedStudent ? (
                  <div className="space-y-3">
                    <div className="relative" ref={studentSearchRef}>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search by student name or registration number..."
                          value={studentSearchQuery}
                          onChange={(e) => { setStudentSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                          onFocus={() => setShowSearchDropdown(true)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                        />
                        {isSearchingStudents && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 animate-spin" />}
                      </div>

                      {showSearchDropdown && studentSearchQuery.trim() && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-2 border border-slate-200 rounded-2xl bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {isSearchingStudents ? (
                            <div className="p-6 text-center text-slate-400">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-500" />
                              <p className="text-xs font-semibold">Searching...</p>
                            </div>
                          ) : studentSearchResults.length > 0 ? (
                            studentSearchResults.map((st: any) => {
                              const studentName = toTitleCase(st.full_name || `${st.first_name || ''} ${st.last_name || ''}`.trim());
                              const regNo = st.registration_number || st.reg_no || 'No Reg No';
                              const classLabel = st.current_class_name || st.current_class || '';

                              return (
                                <div key={st.id} onClick={() => loadWaivableItemsFor(st)} className="p-3.5 hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition-colors gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {st.image_url ? (
                                      <img src={getImageUrl(st.image_url)} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" />
                                    ) : (
                                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0"><GraduationCap className="h-4 w-4 text-emerald-600" /></div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-900 truncate">{studentName}</p>
                                      <p className="text-xs font-mono text-slate-400 truncate">{regNo}</p>
                                      {classLabel && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{classLabel}</p>}
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase shrink-0 ${st.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{st.status || 'Active'}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-6 text-center text-slate-400 text-xs font-medium">No students found</div>
                          )}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2.5 text-xs text-slate-600 font-medium px-1 cursor-pointer select-none">
                      <input type="checkbox" checked={includeInactiveStudents} onChange={(e) => setIncludeInactiveStudents(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                      Include graduated / inactive students (Alumni)
                    </label>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {selectedStudent.image_url ? (
                        <img src={getImageUrl(selectedStudent.image_url)} alt="" className="w-12 h-12 rounded-2xl object-cover border border-emerald-200 shadow-2xs shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-base shrink-0"><GraduationCap className="h-6 w-6 text-emerald-600" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{toTitleCase(selectedStudent.full_name || `${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim())}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{selectedStudent.registration_number || selectedStudent.reg_no || 'No Reg'}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                          {selectedStudent.status === 'graduated' ? 'Graduated' : (selectedStudent.current_class_name || selectedStudent.current_class || 'Enrolled')}
                        </span>
                      </div>
                    </div>
                    {!deepLinkStudentId && (
                      <button onClick={() => { setSelectedStudent(null); setWaivableItems([]); }} className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 px-3 py-1.5 rounded-xl shadow-2xs transition-colors shrink-0">Change Student</button>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Step 2: Outstanding Items */}
              {!deepLinkLoading && selectedStudent && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">2. Select Unpaid Items to Waive</label>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">{validSelections.length} selected</span>
                  </div>

                  {loadingWaivables ? (
                    <div className="py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      <p className="text-xs font-semibold">Fetching outstanding student debts...</p>
                    </div>
                  ) : waivableItems.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 text-xs italic">
                      This student has no outstanding debts or unpaid invoice items to waive.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedWaivableItems.map((group: any) => {
                        const allGroupSelected = group.items.every((it: any) => !!waiverSelections[it.id]);
                        return (
                        <div key={group.label} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {group.label}</h4>
                            <button type="button" onClick={() => toggleSelectAllInGroup(group.items)} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wide transition-colors">
                              {allGroupSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((item: any) => {
                              const isSelected = !!waiverSelections[item.id];
                              const currentVal = isSelected ? waiverSelections[item.id].amount : '';
                              const isInvalid = isSelected && currentVal === '';

                              return (
                                <div key={item.id} className={`p-3.5 rounded-xl border transition-all ${isInvalid ? 'border-rose-400 bg-rose-50/30' : isSelected ? 'border-emerald-500 bg-emerald-50/20 shadow-2xs' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                      <input type="checkbox" checked={isSelected} onChange={() => handleToggleWaivableItem(item)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{toTitleCase(item.description)}</p>
                                        <p className="text-xs font-semibold text-slate-400">Max Balance: <span className="font-mono text-slate-700">{fmtMoney(parseFloat(item.balance))}</span></p>
                                      </div>
                                    </label>
                                    {isSelected && (
                                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-bold text-slate-400">₦</span>
                                          <input type="number" step="0.01" max={item.balance} value={currentVal} onChange={(e) => handleUpdateWaiverAmount(item.id, e.target.value)} placeholder={item.balance} className={`w-28 px-3 py-1.5 text-xs font-black text-slate-900 bg-white border rounded-xl outline-none focus:ring-2 text-right shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isInvalid ? 'border-rose-400 focus:ring-rose-400' : 'border-emerald-300 focus:ring-emerald-500'}`} />
                                        </div>
                                        {isInvalid && <span className="text-[10px] font-bold text-rose-500">Enter an amount</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Reason */}
              {!deepLinkLoading && selectedStudent && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">3. Reason for Waiver <span className="text-rose-500">*</span></label>
                  <textarea rows={3} placeholder="State clear justification for this waiver..." value={globalReason} onChange={(e) => setGlobalReason(e.target.value)} className="w-full p-3.5 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800" />
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
              <div>
                {validSelections.length > 0 && <p className="text-xs font-bold text-slate-600">Total Waived: <span className="text-sm font-black text-emerald-700">{fmtMoney(validSelections.reduce((s, x) => s + parseFloat(x.amount || 0), 0))}</span></p>}
                {hasInvalidSelections && <p className="text-[10px] font-bold text-rose-500 mt-0.5">Some selected items are missing an amount.</p>}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={closeNewWaiverDrawer} className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">{returnTo ? 'Cancel & Return' : 'Cancel'}</button>
                <button disabled={validSelections.length === 0 || hasInvalidSelections || !globalReason.trim() || actionLoading} onClick={() => setConfirmModal(true)} className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-200 transition-colors flex items-center justify-center gap-1.5"><Award className="w-4 h-4" /> Submit Waiver Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AUDIT DETAIL DRAWER (WITH EDIT & REVERSE MODE) ───────────────── */}
      {isDrawerOpen && selectedGroup && (
        <div onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Waiver Audit Trail</span>
                <h3 className="text-base font-bold">Ref: {selectedGroup.reference}</h3>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Total Amount Waived</p>
                  <p className="text-3xl font-black text-slate-900">
                    {fmtMoney(selectedGroup.items.reduce((s: number, i: any) => s + parseFloat(isEditingWaiver ? (waiverEdits[i.id] || 0) : (i.amount_waived || 0)), 0))}
                  </p>
                </div>
                {!isEditingWaiver && <StatusBadge status={selectedGroup.status} />}
              </div>

              {selectedGroup.rejection_reason && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-600" /> Note / Rejection Reason</span>
                  <p className="text-xs text-rose-950 font-medium leading-relaxed">{selectedGroup.rejection_reason}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student Profile</h4>
                <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center gap-3.5">
                  {selectedGroup.student_image_url ? (
                    <img src={getImageUrl(selectedGroup.student_image_url)} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-base shrink-0"><GraduationCap className="h-6 w-6 text-emerald-600" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-base truncate">{toTitleCase(selectedGroup.student_name)}</p>
                    <p className="text-[10px] font-mono text-slate-500 uppercase truncate">{selectedGroup.student_reg_no}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">{selectedGroup.student_class}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items Waived ({selectedGroup.items.length})</h4>

                  {canManageWaivers && selectedGroup.status !== 'reversed' && !isEditingWaiver && (
                    <button
                      onClick={handleStartEditing}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Values
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedGroup.items.map((item: any) => {
                    const originalAmount = parseFloat(item.amount_waived || '0');
                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between shadow-2xs transition-colors ${isEditingWaiver ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-bold text-slate-900 truncate">{toTitleCase(item.item_description || 'Fee Item')}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">Reason: {item.reason || selectedGroup.reason}</p>
                        </div>

                        {isEditingWaiver ? (
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400">₦</span>
                              <input
                                type="number"
                                step="0.01"
                                value={waiverEdits[item.id] !== undefined ? waiverEdits[item.id] : item.amount_waived}
                                onChange={(e) => setWaiverEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-24 px-3 py-1.5 text-sm font-black text-slate-900 bg-white border border-blue-300 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none text-right shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="font-black text-slate-900 shrink-0">{fmtMoney(originalAmount)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!isEditingWaiver && (() => {
                  const uniqueInvoices = getUniqueInvoiceLinks(selectedGroup.items);
                  if (uniqueInvoices.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {uniqueInvoices.map(({ id, type }) => (
                        <button key={id} onClick={() => { setIsDrawerOpen(false); router.push(`/dashboard/staff/fee/invoices/${id}?type=${type}`); }} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px] uppercase font-bold bg-blue-50 px-2 py-1 rounded transition-colors">
                          <ExternalLink className="w-3 h-3" /> View {type === 'family' ? 'Family Invoice' : 'Invoice'}{uniqueInvoices.length > 1 ? ` #${id}` : ''}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Governance</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 block mb-1">Requested By:</span>
                    <strong className="text-slate-800">{selectedGroup.requested_by_name || 'System / Admin'}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{formatDate(selectedGroup.created_at)}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 block mb-1">Reviewed By:</span>
                    <strong className="text-slate-800">{selectedGroup.reviewed_by_name || 'Pending Review'}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{formatDate(selectedGroup.reviewed_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-end gap-2 flex-shrink-0">
              {isEditingWaiver ? (
                <>
                  <button onClick={() => setIsEditingWaiver(false)} disabled={actionLoading} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors">Cancel Edits</button>
                  <button onClick={handleSaveCorrections} disabled={actionLoading} className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-200">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Corrections
                  </button>
                </>
              ) : (
                <>
                  {selectedGroup.status === 'pending' && canManageWaivers && (
                    <>
                      <button disabled={actionLoading} onClick={() => setRejectModal({ open: true, item: selectedGroup })} className="px-4 py-2.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
                      <button disabled={actionLoading} onClick={() => setApproveModal({ open: true, item: selectedGroup })} className="px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                    </>
                  )}
                  {selectedGroup.status === 'approved' && canManageWaivers && (
                    <button disabled={actionLoading} onClick={() => setReverseModal({ open: true, item: selectedGroup })} className="px-4 py-2.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5">
                      <RotateCcw className="w-4 h-4" /> Reverse Waiver
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── BULK WAIVER COPY WIZARD ───────────────────────────────────── */}
      <WaiverCopyWizard
        isOpen={isCopyWizardOpen}
        onClose={() => setIsCopyWizardOpen(false)}
        onSuccess={fetchWaiversAndStats}
        showToast={showToast}
      />
    </div>
  );
}

export default function WaiversPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}>
      <WaiversContent />
    </Suspense>
  );
}