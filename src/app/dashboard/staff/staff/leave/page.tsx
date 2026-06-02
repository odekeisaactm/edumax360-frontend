'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { staffAPI, leaveAPI } from '@/lib/api';
import { StaffLeave } from '@/lib/types';
import {
  ArrowLeft, Plus, Search, X, Check, ChevronLeft, ChevronRight,
  Calendar, Clock, AlertCircle, Loader2, Filter, UserCircle,
  CheckCircle2, XCircle, RefreshCw, Eye,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const STAFF_INDEX = '/dashboard/staff/staff';
const PAGE_SIZE   = 15;

const LEAVE_TYPES = [
  { value: 'annual',    label: 'Annual Leave'    },
  { value: 'sick',      label: 'Sick Leave'      },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'unpaid',    label: 'Unpaid Leave'    },
  { value: 'study',     label: 'Study Leave'     },
  { value: 'other',     label: 'Other'           },
];

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  approved:  { label: 'Approved',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  active:    { label: 'Active',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
  declined:  { label: 'Declined',  bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-300'   },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (!d) return err?.message || 'Something went wrong';
  if (typeof d === 'string') return d;
  if (d.message) return d.message;
  if (d.detail)  return d.detail;
  const first = Object.values(d)[0];
  if (Array.isArray(first)) return String(first[0]);
  return JSON.stringify(d);
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function leaveTypeLabel(value: string): string {
  return LEAVE_TYPES.find(t => t.value === value)?.label ?? value;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Leave Detail Modal ───────────────────────────────────────────────────────
function LeaveDetailModal({ leave, onClose, onApprove, onDecline, onChangeStatus, canApprove, actionLoading }: {
  leave: StaffLeave;
  onClose: () => void;
  onApprove: (id: number) => void;
  onDecline: (id: number) => void;
  onChangeStatus: (id: number, status: string, extra?: { actual_end_date?: string }) => void;
  canApprove: boolean;
  actionLoading: number | null;
}) {
  const staffName   = (leave as any).staff_name ?? `Staff #${leave.staff}`;
  const isPending   = leave.status === 'pending';
  const isApproved  = leave.status === 'approved';
  const isActive    = leave.status === 'active';
  const isActioning = actionLoading === leave.id;
  const [endDate, setEndDate] = useState('');
  const [showEndEarly, setShowEndEarly] = useState(false);

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-700">{value || '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Eye className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Leave Request</p>
              <p className="text-xs text-slate-400">{staffName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Staff + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{staffName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{staffName}</p>
                {(leave as any).staff_id && <p className="text-xs text-slate-400">{(leave as any).staff_id}</p>}
              </div>
            </div>
            <StatusBadge status={leave.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
            <Row label="Leave Type"   value={leaveTypeLabel(leave.leave_type)} />
            <Row label="Applied On"   value={fmt((leave as any).created_at)} />
            <Row label="Start Date"   value={fmt(leave.start_date)} />
            <Row label="Expected End" value={fmt(leave.expected_end_date)} />
            {leave.actual_end_date && <Row label="Actual End"  value={fmt(leave.actual_end_date)} />}
            {(leave as any).approved_by_name && <Row label="Actioned By" value={(leave as any).approved_by_name} />}
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-slate-700 leading-relaxed">{leave.reason || '—'}</p>
            </div>
            {(leave as any).notes && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-slate-700 leading-relaxed">{(leave as any).notes}</p>
              </div>
            )}
            {leave.status === 'declined' && (leave as any).decline_reason && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wide mb-1">Decline Reason</p>
                <p className="text-sm text-red-700 leading-relaxed">{(leave as any).decline_reason}</p>
              </div>
            )}
          </div>

          {/* End early inline form */}
          {canApprove && isActive && showEndEarly && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">End Leave Early</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Actual End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEndEarly(false)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => { onChangeStatus(leave.id, 'completed', { actual_end_date: endDate || undefined }); onClose(); }}
                  disabled={isActioning}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50">
                  Confirm End
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canApprove && (
          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 flex-wrap">
            {isPending && (
              <>
                <button onClick={() => { onDecline(leave.id); onClose(); }} disabled={isActioning}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
                  <XCircle className="h-4 w-4" /> Decline
                </button>
                <button onClick={() => { onApprove(leave.id); onClose(); }} disabled={isActioning}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-xl transition-all shadow-md disabled:opacity-50">
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve
                </button>
              </>
            )}
            {isApproved && (
              <>
                <button onClick={() => { onChangeStatus(leave.id, 'active'); onClose(); }} disabled={isActioning}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Mark Active
                </button>
                <button onClick={() => { onChangeStatus(leave.id, 'cancelled'); onClose(); }} disabled={isActioning}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
            {isActive && !showEndEarly && (
              <>
                <button onClick={() => { onChangeStatus(leave.id, 'completed'); onClose(); }} disabled={isActioning}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Mark Completed
                </button>
                <button onClick={() => setShowEndEarly(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
                  <Calendar className="h-4 w-4" /> End Early
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Staff Search ─────────────────────────────────────────────────────────────
function StaffSearch({ value, onSelect, onClear, placeholder = 'Search staff...' }: {
  value: string;
  onSelect: (staff: { id: number; name: string }) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timer                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef               = useRef<HTMLDivElement>(null);

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800 placeholder:text-slate-300';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    staffAPI.list({ search: q, page: 1, page_size: 8 })
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
        const arr  = Array.isArray(list) ? list : (list?.data ?? []);
        setResults(arr);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 350);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 border border-blue-200 bg-blue-50 rounded-xl">
        <UserCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span className="text-sm font-medium text-blue-800 flex-1 truncate">{value}</span>
        <button type="button" onClick={onClear} className="text-blue-400 hover:text-blue-600 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 pointer-events-none" />
        {loading
          ? <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 animate-spin" />
          : query
            ? <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X className="h-3.5 w-3.5" />
              </button>
            : null
        }
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={inputCls + ' pl-9 pr-9'}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          {results.map(s => {
            const name = s.full_name ?? (`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.id}`);
            return (
              <button key={s.id} type="button"
                onClick={() => { onSelect({ id: s.id, name }); setQuery(''); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">{name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                  {s.staff_id && <p className="text-xs text-slate-400">{s.staff_id}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Leave Modal ───────────────────────────────────────────────────────
function CreateLeaveModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState({
    leave_type: '', start_date: '', expected_end_date: '', reason: '', notes: '',
  });

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800 placeholder:text-slate-300';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) { setError('Please select a staff member'); return; }
    setCreating(true); setError(null);
    try {
      await leaveAPI.createForStaff(selectedStaff.id, { ...form, staff: selectedStaff.id });
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Plus className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">New Leave Request</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="h-4 w-4" /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5">
          <form id="create-leave-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Staff Member *</label>
              <StaffSearch
                value={selectedStaff?.name ?? ''}
                onSelect={setSelectedStaff}
                onClear={() => setSelectedStaff(null)}
                placeholder="Search by name or ID..."
              />
            </div>

            <div>
              <label className={labelCls}>Leave Type *</label>
              <select required value={form.leave_type} onChange={set('leave_type')} className={inputCls + ' cursor-pointer'}>
                <option value="">Select type</option>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Date *</label>
                <input type="date" required value={form.start_date} onChange={set('start_date')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Expected End Date *</label>
                <input type="date" required value={form.expected_end_date} onChange={set('expected_end_date')} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Reason *</label>
              <textarea required rows={3} value={form.reason} onChange={set('reason')}
                placeholder="Reason for leave..."
                className={inputCls + ' resize-none'} />
            </div>

            <div>
              <label className={labelCls}>Notes <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} value={form.notes} onChange={set('notes')}
                placeholder="Additional notes..."
                className={inputCls + ' resize-none'} />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={creating}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="create-leave-form" disabled={creating}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2">
            {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Check className="h-4 w-4" /> Create Request</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Decline Modal ────────────────────────────────────────────────────────────
function DeclineModal({ onConfirm, onClose, loading }: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Decline Leave</p>
            <p className="text-xs text-slate-500">Provide a reason for the staff member</p>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason for declining..."
          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none resize-none mb-4 placeholder:text-slate-300 text-slate-800"
        />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Declining...</> : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeaveManagementPage() {
  const router   = useRouter();
  const { user } = useAuth();

  // Try multiple permission structures to be safe
  const canApprove = (
    (user as any)?.permissions?.includes('human_resource.can_approve_leave') ||
    (user as any)?.user_permissions?.includes('human_resource.can_approve_leave') ||
    (user as any)?.is_superuser ||
    (user as any)?.is_staff
  ) ?? false;

  // Data
  const [leaves, setLeaves]   = useState<StaffLeave[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [typeFilter, setType]     = useState('');
  const [selectedStaff, setSelectedStaff] = useState<{ id: number; name: string } | null>(null);
  const [page, setPage]           = useState(1);

  // Modals
  const [showCreate, setShowCreate]   = useState(false);
  const [viewLeave, setViewLeave]     = useState<StaffLeave | null>(null);
  const [declining, setDeclining]     = useState<number | null>(null);
  const [declLoading, setDeclLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, active: 0 });

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800 placeholder:text-slate-300';

  const loadLeaves = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: PAGE_SIZE };
      if (statusFilter)  params.status     = statusFilter;
      if (typeFilter)    params.leave_type = typeFilter;
      if (selectedStaff) params.staff      = selectedStaff.id;
      if (search.trim()) params.search     = search.trim();

      const res: any = await leaveAPI.list(params);
      const list = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
      const arr  = Array.isArray(list) ? list : (list?.data ?? []);
      setLeaves(arr);
      setTotal(res?.count ?? arr.length);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setLoading(false); }
  }, [statusFilter, typeFilter, selectedStaff, search]);

  const loadStats = async () => {
    try {
      const [all, pend, appr, act] = await Promise.all([
        leaveAPI.list({} as any),
        leaveAPI.list({ status: 'pending'  } as any),
        leaveAPI.list({ status: 'approved' } as any),
        leaveAPI.list({ status: 'active'   } as any),
      ]);
      const count = (r: any) => r?.count ?? (Array.isArray(r) ? r.length : (r?.data?.length ?? 0));
      setStats({ total: count(all), pending: count(pend), approved: count(appr), active: count(act) });
    } catch { /* silent */ }
  };

  useEffect(() => { setPage(1); loadLeaves(1); }, [statusFilter, typeFilter, selectedStaff, search]);
  useEffect(() => { loadLeaves(page); }, [page]);
  useEffect(() => { loadStats(); }, []);

  const refresh = () => { loadLeaves(page); loadStats(); };

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await leaveAPI.approve(id);
      showToast('success', 'Leave approved');
      refresh();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(null); }
  };

  const handleDecline = async (reason: string) => {
    if (!declining) return;
    setDeclLoading(true);
    try {
      await leaveAPI.decline(declining, reason);
      showToast('success', 'Leave declined');
      setDeclining(null);
      refresh();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setDeclLoading(false); }
  };

  const handleChangeStatus = async (id: number, newStatus: string, extra?: { actual_end_date?: string }) => {
    setActionLoading(id);
    try {
      await leaveAPI.changeStatus(id, { status: newStatus, ...extra });
      showToast('success', `Leave marked as ${newStatus}`);
      refresh();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(null); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statCards = [
    { label: 'Total',    value: stats.total,    color: 'bg-slate-100 text-slate-700'    },
    { label: 'Pending',  value: stats.pending,  color: 'bg-amber-50 text-amber-700'     },
    { label: 'Approved', value: stats.approved, color: 'bg-blue-50 text-blue-700'       },
    { label: 'Active',   value: stats.active,   color: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateLeaveModal
          onSuccess={() => { setShowCreate(false); showToast('success', 'Leave request created'); refresh(); }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {viewLeave && (
        <LeaveDetailModal
          leave={viewLeave}
          onClose={() => setViewLeave(null)}
          onApprove={handleApprove}
          onDecline={(id) => { setViewLeave(null); setDeclining(id); }}
          onChangeStatus={handleChangeStatus}
          canApprove={canApprove}
          actionLoading={actionLoading}
        />
      )}
      {declining !== null && (
        <DeclineModal onConfirm={handleDecline} onClose={() => setDeclining(null)} loading={declLoading} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(STAFF_INDEX)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Leave Management</h1>
                <p className="text-sm text-slate-500">Review and manage all staff leave requests</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm" title="Refresh">
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> New Request
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(s => (
            <div key={s.label} className={`rounded-2xl px-4 py-3 flex items-center justify-between ${s.color}`}>
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</span>
              <span className="text-2xl font-bold">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Staff</label>
              <StaffSearch
                value={selectedStaff?.name ?? ''}
                onSelect={s => setSelectedStaff(s)}
                onClear={() => setSelectedStaff(null)}
                placeholder="Filter by staff..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={statusFilter} onChange={e => setStatus(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_META).map(([v, m]) => (
                  <option key={v} value={v}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leave Type</label>
              <select value={typeFilter} onChange={e => setType(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">All types</option>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..." className={inputCls + ' pl-9 pr-9'} />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {(statusFilter || typeFilter || selectedStaff || search) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">Active:</span>
              {selectedStaff && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                  {selectedStaff.name}
                  <button onClick={() => setSelectedStaff(null)}><X className="h-3 w-3" /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                  {STATUS_META[statusFilter]?.label ?? statusFilter}
                  <button onClick={() => setStatus('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                  {leaveTypeLabel(typeFilter)}
                  <button onClick={() => setType('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                  "{search}"
                  <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              <button onClick={() => { setStatus(''); setType(''); setSelectedStaff(null); setSearch(''); }}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-400">Loading leave requests...</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Calendar className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No leave requests found</p>
              <p className="text-xs text-slate-400">Try adjusting your filters or create a new request</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leaves.map(leave => {
                      const staffName   = (leave as any).staff_name ?? (`Staff #${leave.staff}`);
                      const isPending   = leave.status === 'pending';
                      const isActioning = actionLoading === leave.id;

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">

                          {/* Staff */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">{staffName.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{staffName}</p>
                                {(leave as any).staff_id && (
                                  <p className="text-xs text-slate-400">{(leave as any).staff_id}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700">
                              <Clock className="h-3 w-3" />
                              {leaveTypeLabel(leave.leave_type)}
                            </span>
                          </td>

                          {/* Period */}
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-700 font-medium whitespace-nowrap">
                              {fmt(leave.start_date)} → {fmt(leave.expected_end_date)}
                            </p>
                            {leave.actual_end_date && (
                              <p className="text-xs text-slate-400 mt-0.5">Ended: {fmt(leave.actual_end_date)}</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <StatusBadge status={leave.status} />
                            {(leave as any).approved_by_name && leave.status !== 'pending' && (
                              <p className="text-xs text-slate-400 mt-1">by {(leave as any).approved_by_name}</p>
                            )}
                          </td>

                          {/* Actions — always visible */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Details */}
                              <button onClick={() => setViewLeave(leave)} title="View details"
                                className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Approve + Decline — pending only, gated */}
                              {canApprove && isPending && (
                                <>
                                  <button onClick={() => handleApprove(leave.id)} disabled={isActioning} title="Approve"
                                    className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                    {isActioning
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  </button>
                                  <button onClick={() => setDeclining(leave.id)} disabled={isActioning} title="Decline"
                                    className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50">
                                    <XCircle className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const n = totalPages <= 5 ? i + 1
                        : page <= 3 ? i + 1
                        : page >= totalPages - 2 ? totalPages - 4 + i
                        : page - 2 + i;
                      return (
                        <button key={n} onClick={() => setPage(n)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors
                            ${page === n
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          {n}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}