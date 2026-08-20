'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { allocationAPI, allocationManagementAPI, collectionEventAPI, inventoryLocationAPI, academicAPI, academicCalendarAPI, studentsAPI, inventoryAssignmentAPI } from '@/lib/api';
import { Allocation, AllocationList, ClassModel, InventoryLocation, InventoryAssignment } from '@/lib/types';
import {
  Search, Check, X, AlertCircle, Loader2, Users, Package, Boxes,
  ChevronLeft, ChevronRight, ArrowLeft, PackageCheck, Clock, CheckCircle2,
  Wallet, Ban, Trash2, UserPlus, CreditCard, Store, Banknote, User
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

// ─── Status Badge ───
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    'pending': { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
    'partially_collected': { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" />, label: 'Partial' },
    'collected': { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Collected' },
    'returned': { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: <PackageCheck className="h-3 w-3" />, label: 'Returned' },
  };
  const s = map[status] || map['pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Item Payment Badge ───
function ItemPaymentBadge({ isFree, amountOutstanding, quantityOutstanding }: { isFree: boolean; amountOutstanding: number; quantityOutstanding: number }) {
  if (isFree) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-500 border border-slate-200">
        Free
      </span>
    );
  }
  if (quantityOutstanding <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Collected
      </span>
    );
  }
  if (amountOutstanding <= 0 && quantityOutstanding > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-50 text-amber-600 border border-amber-200">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-50 text-amber-600 border border-amber-200">
      <Clock className="h-3 w-3" /> Unpaid
    </span>
  );
}

// ─── Collect Modal ───
function CollectModal({ studentName, studentImage, items, locations, isSubmitting, onConfirm, onCancel }: {
  studentName: string;
  studentImage?: string | null;
  items: any[];
  locations: InventoryLocation[];
  isSubmitting: boolean;
  onConfirm: (data: { items: any[]; location_id: number; payment_method: string }) => void;
  onCancel: () => void;
}) {
  const [collectItems, setCollectItems] = useState<Record<number, string>>({});
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0].id.toString() : '');
  const [paymentMethod, setPaymentMethod] = useState<string>('student_wallet');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const totalQty = Object.values(collectItems).reduce((sum, qty) => sum + (parseFloat(qty || '0') || 0), 0);

  // Only calculate amount for NON-FREE items
  const totalAmount = items.reduce((sum, item) => {
    if (item.assignment_is_free) return sum;
    const qty = parseFloat(collectItems[item.id] || '0') || 0;
    return sum + (qty * parseFloat(item.assignment_item_price || '0'));
  }, 0);

  const handleSubmit = () => {
    setAttemptedSubmit(true);
    if (totalQty <= 0) return;
    if (!locationId) return;

    const payload = items
      .filter(item => (parseFloat(collectItems[item.id] || '0') || 0) > 0)
      .map(item => ({
        allocation_item_id: item.id,
        quantity: collectItems[item.id],
      }));

    onConfirm({
      items: payload,
      location_id: parseInt(locationId),
      payment_method: paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
              {studentImage ? (
                <img src={studentImage} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                toTitleCase(studentName).charAt(0)
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Collect Items</h3>
              <p className="text-xs text-slate-500">{toTitleCase(studentName)}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.map(item => {
            const outstanding = parseFloat(item.outstanding_quantity || '0');
            const price = parseFloat(item.assignment_item_price || '0');
            const isFree = item.assignment_is_free;
            const qty = parseFloat(collectItems[item.id] || '0') || 0;

            return (
              <div key={item.id} className="border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-800">{item.assignment_item_name}</p>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    {outstanding} outstanding
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {isFree ? (
                      <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Free Item</span>
                    ) : (
                      <p className="text-[10px] text-slate-400">Price: {fmtMoney(price)}</p>
                    )}
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      max={outstanding}
                      step="0.01"
                      value={collectItems[item.id] || ''}
                      onChange={e => setCollectItems(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="0"
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {parseFloat(collectItems[item.id] || '0') > outstanding && (
                      <p className="text-[9px] text-red-500 font-bold mt-1">Exceeds outstanding</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white">
                <option value="">Select store...</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
              {attemptedSubmit && !locationId && (
                <p className="text-[9px] text-red-500 font-bold mt-1">Location required</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white">
                <option value="student_wallet">Student Wallet</option>
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total to Pay</p>
            <p className="text-lg font-black text-cyan-600">{fmtMoney(totalAmount)}</p>
          </div>
          <button onClick={handleSubmit} disabled={isSubmitting || totalQty <= 0}
            className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual Assign Modal ───
function ManualAssignModal({ assignments, isSubmitting, onConfirm, onCancel }: {
  assignments: InventoryAssignment[];
  isSubmitting: boolean;
  onConfirm: (data: { student_id: number; assignment_id: number }) => void;
  onCancel: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await studentsAPI.list({ search: searchQuery.trim(), status: 'active', page_size: 8 });
        setSearchResults(res.results || res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery]);

  const handleSubmit = () => {
    if (!selectedStudent || !selectedAssignment) return;
    onConfirm({
      student_id: selectedStudent.id,
      assignment_id: parseInt(selectedAssignment),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-cyan-600" />
            </div>
            <h3 className="font-bold text-slate-900">Manual Assign</h3>
          </div>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Student</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 border-2 border-cyan-500 bg-cyan-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {selectedStudent.image_url ? (
                    <img src={selectedStudent.image_url} alt="" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs">
                      {toTitleCase(selectedStudent.full_name || `${selectedStudent.first_name} ${selectedStudent.last_name}`).charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{toTitleCase(selectedStudent.full_name || `${selectedStudent.first_name} ${selectedStudent.last_name}`)}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{selectedStudent.registration_number}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-1.5 hover:bg-cyan-100 rounded-lg text-cyan-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search student..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600 animate-spin" />}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(st => {
                      const studentName = st.full_name || `${st.first_name} ${st.last_name}`;
                      return (
                        <button key={st.id} type="button" onClick={() => { setSelectedStudent(st); setSearchQuery(''); setSearchResults([]); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3">
                          {st.image_url ? (
                            <img src={st.image_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {toTitleCase(studentName).charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-slate-800">{toTitleCase(studentName)}</p>
                            <p className="text-[10px] text-slate-400">{st.registration_number}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assignment</label>
            <select value={selectedAssignment} onChange={e => setSelectedAssignment(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white">
              <option value="">Select assignment...</option>
              {assignments.map(a => (
                <option key={a.id} value={a.id}>{a.title || a.item_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-200 bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !selectedStudent || !selectedAssignment}
            className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 shadow-md disabled:opacity-50 flex items-center gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Terminate Modal ───
function TerminateModal({ allocationItem, isSubmitting, onConfirm, onCancel }: {
  allocationItem: any | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!allocationItem) return null;

  const hasCollected = parseFloat(allocationItem.quantity_collected || '0') > 0;
  const isPaid = parseFloat(allocationItem.amount_collected || '0') > 0;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${hasCollected ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
          {hasCollected ? <Package className="h-6 w-6" /> : <Ban className="h-6 w-6" />}
        </div>

        {hasCollected ? (
          <>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">Cannot Terminate</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              <strong>{allocationItem.item_name}</strong> has already been collected. Process a return first.
            </p>
            <button onClick={onCancel} className="w-full py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200">
              Understood
            </button>
          </>
        ) : (
          <>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">Terminate Allocation?</h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Remove <strong>{allocationItem.item_name}</strong> from this student.
              {isPaid && (
                <span className="block mt-2 text-amber-600 font-semibold">
                  Wallet refund will be processed if within grace period.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel} disabled={isSubmitting}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={isSubmitting}
                className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terminate'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function AllocationsContent() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('inventory.view_inventoryassignmentmodel');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectStudent, setCollectStudent] = useState<any | null>(null);
  const [showManualAssignModal, setShowManualAssignModal] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load Reference Data ──
  useEffect(() => {
    const loadRefData = async () => {
      try {
        const [clsRes, locRes, assignRes, sessRes] = await Promise.all([
          academicAPI.listClasses({ is_active: true }),
          inventoryLocationAPI.list(),
          inventoryAssignmentAPI.list({ page_size: 100, is_active: true }),
          academicCalendarAPI.listSessions(),
        ]);
        setClasses(Array.isArray(clsRes) ? clsRes : clsRes?.results || []);
        const locData = Array.isArray(locRes) ? locRes : locRes?.results || [];
        setLocations(locData.filter((l: any) => l.location_type === 'store'));
        setAssignments(Array.isArray(assignRes) ? assignRes : assignRes?.results || []);
        const sessArray = Array.isArray(sessRes) ? sessRes : [];
        setSessions(sessArray);

        const curSess = sessArray.find((s: any) => s.is_active);
        if (curSess) {
          setFilterSessionId(curSess.id.toString());
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: curSess.id });
          setPeriods(perData);
          const curPer = perData.find((p: any) => p.is_current);
          if (curPer) setFilterPeriodId(curPer.id.toString());
          else if (perData.length > 0) setFilterPeriodId(perData[0].id.toString());
        }
      } catch (err) {
        showToast('error', extractError(err));
      }
    };
    loadRefData();
  }, [showToast]);

  useEffect(() => {
    if (!filterSessionId) return;
    academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
      .then(res => {
        setPeriods(res);
        if (res.length > 0 && !res.find((p: any) => p.id.toString() === filterPeriodId)) {
          setFilterPeriodId(res[0].id.toString());
        }
      })
      .catch(() => setPeriods([]));
  }, [filterSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        page_size: 20,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterClassId) params.class_id = filterClassId;
      if (filterStatus) params.status = filterStatus;
      if (filterPeriodId) params.academic_period = filterPeriodId;

      const res = await allocationAPI.list(params);
      const data = Array.isArray(res) ? res : res?.results || [];
      const count = typeof res?.count === 'number' ? res.count : data.length;

      const expandedData = await Promise.all(
        data.map(async (a: any) => {
          try {
            const detail = await allocationAPI.get(a.id);
            return { ...a, detail };
          } catch {
            return a;
          }
        })
      );

      setAllocations(expandedData);
      setTotal(count);
      setTotalPages(Math.max(1, Math.ceil(count / 20)));
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, filterClassId, filterStatus, filterPeriodId, showToast]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchAllocations();
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [fetchAllocations]);

  const handleCollect = async (data: { items: any[]; location_id: number; payment_method: string }) => {
    if (!collectStudent) return;
    setIsSubmitting(true);
    try {
      await collectionEventAPI.record({
        allocation_id: collectStudent.id,
        items: data.items,
        location_id: data.location_id,
        payment_method: data.payment_method,
      });
      showToast('success', 'Collection recorded successfully!');
      setShowCollectModal(false);
      setCollectStudent(null);
      fetchAllocations();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAssign = async (data: { student_id: number; assignment_id: number }) => {
    setIsSubmitting(true);
    try {
      await allocationManagementAPI.manualAssign(data);
      showToast('success', 'Student assigned successfully.');
      setShowManualAssignModal(false);
      fetchAllocations();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setIsSubmitting(true);
    try {
      await allocationManagementAPI.terminate(terminateTarget.allocation_item_id);
      showToast('success', 'Allocation terminated successfully.');
      setTerminateTarget(null);
      fetchAllocations();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const pending = allocations.filter(a => a.status === 'pending').length;
    const partial = allocations.filter(a => a.status === 'partially_collected').length;
    const collected = allocations.filter(a => a.status === 'collected').length;
    const returned = allocations.filter(a => a.status === 'returned').length;
    return { pending, partial, collected, returned, total: total };
  }, [allocations, total]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {showCollectModal && collectStudent && (
        <CollectModal
          studentName={collectStudent.student_name}
          studentImage={collectStudent.student_image_url}
          items={collectStudent.detail?.items || []}
          locations={locations}
          isSubmitting={isSubmitting}
          onConfirm={handleCollect}
          onCancel={() => { setShowCollectModal(false); setCollectStudent(null); }}
        />
      )}
      {showManualAssignModal && (
        <ManualAssignModal
          assignments={assignments}
          isSubmitting={isSubmitting}
          onConfirm={handleManualAssign}
          onCancel={() => setShowManualAssignModal(false)}
        />
      )}
      <TerminateModal
        allocationItem={terminateTarget}
        isSubmitting={isSubmitting}
        onConfirm={handleTerminate}
        onCancel={() => setTerminateTarget(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3.5">
          <button onClick={() => router.push('/dashboard/staff/inventory/assignments/jobs')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">View Allocations</h1>
            <p className="text-xs text-slate-500 mt-0.5">All allocations grouped by student — collect, assign, and manage here</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setShowManualAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
            <UserPlus className="h-4 w-4" /> Manual Assign
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
          <p className="text-xl font-black text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
          <p className="text-xl font-black text-slate-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Partial</p>
          <p className="text-xl font-black text-amber-700 mt-1">{stats.partial}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Collected</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{stats.collected}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Returned</p>
          <p className="text-xl font-black text-purple-700 mt-1">{stats.returned}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search student..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white" />
        </div>

        <select value={filterSessionId} onChange={e => { setFilterSessionId(e.target.value); setCurrentPage(1); }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white">
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
        </select>

        <select value={filterPeriodId} onChange={e => { setFilterPeriodId(e.target.value); setCurrentPage(1); }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white">
          <option value="">All Terms</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
        </select>

        <select value={filterClassId} onChange={e => { setFilterClassId(e.target.value); setCurrentPage(1); }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="partially_collected">Partially Collected</option>
          <option value="collected">Collected</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      {/* Table — ALL expanded by default */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-14 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-600 mb-3" />
            <p className="text-sm font-semibold">Loading allocations...</p>
          </div>
        ) : allocations.length === 0 ? (
          <div className="p-14 flex flex-col items-center justify-center text-slate-400">
            <Package className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">No allocations found</p>
            <p className="text-xs mt-1">Run a generation job or manually assign.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {allocations.map(a => (
              <div key={a.id}>
                {/* Student Header */}
                <div className="px-5 py-4 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {a.student_image_url ? (
                      <img src={a.student_image_url} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {toTitleCase(a.student_name).charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{toTitleCase(a.student_name)}</p>
                      <p className="text-[10px] font-mono text-slate-400">{a.student_registration_number} • {a.student_class_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded-full">
                      {a.total_items} Item{a.total_items !== 1 ? 's' : ''}
                    </span>
                    <StatusBadge status={a.status} />
                    {canManage && a.detail?.items?.some((item: any) => parseFloat(item.outstanding_quantity) > 0) && (
                      <button
                        onClick={() => { setCollectStudent(a); setShowCollectModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white text-[10px] font-bold rounded-lg hover:bg-cyan-700 transition-colors"
                      >
                        <PackageCheck className="h-3.5 w-3.5" /> Collect
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="px-5 py-3 space-y-2 bg-white">
                  {a.detail?.items?.map((item: any) => {
                    const itemOutstandingQty = parseFloat(item.outstanding_quantity || '0');
                    const itemOutstandingAmt = parseFloat(item.amount_outstanding || '0');
                    const itemCollectedQty = parseFloat(item.quantity_collected || '0');
                    const itemAssignedQty = parseFloat(item.quantity_assigned || '0');

                    return (
                      <div key={item.id} className="flex items-center justify-between flex-wrap gap-2 border border-slate-100 rounded-lg p-3 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{item.assignment_item_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {itemAssignedQty} {item.assignment_item_unit} assigned • {itemCollectedQty} collected
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <ItemPaymentBadge
                            isFree={item.assignment_is_free}
                            amountOutstanding={itemOutstandingAmt}
                            quantityOutstanding={itemOutstandingQty}
                          />
                          {itemOutstandingQty > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {itemOutstandingQty} outstanding
                            </span>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setTerminateTarget({
                                allocation_item_id: item.id,
                                item_name: item.assignment_item_name,
                                quantity_collected: item.quantity_collected,
                                amount_collected: item.amount_collected,
                              })}
                              title="Terminate allocation"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages} (Total: {total})</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewAllocationsPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-600" /></div>}>
      <AllocationsContent />
    </Suspense>
  );
}