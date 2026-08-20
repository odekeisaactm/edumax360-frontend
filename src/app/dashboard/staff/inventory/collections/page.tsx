'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { collectionEventAPI, allocationAPI } from '@/lib/api';
import { CollectionEventList, CollectionEvent } from '@/lib/types';
import {
  PackageCheck, Search, X, Eye, ChevronLeft, ChevronRight, Undo2,
  AlertCircle, Loader2, RefreshCw, User, Wallet, Store, CreditCard,
  FileText, CheckCircle2, Clock, Package
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

const PAGE_SIZE = 20;

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);
  }
  return err?.message || 'An unexpected error occurred.';
}

function titleCase(str: string): string {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(amount: string | number | undefined | null): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB');
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB');
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Payment Badge ───
function PaymentBadge({ method }: { method: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    'student_wallet': { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Wallet className="h-3 w-3" />, label: 'Wallet' },
    'cash': { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CreditCard className="h-3 w-3" />, label: 'Cash' },
    'pos': { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <CreditCard className="h-3 w-3" />, label: 'POS' },
  };
  const s = map[method] || { cls: 'bg-slate-50 text-slate-600 border-slate-200', icon: <CreditCard className="h-3 w-3" />, label: titleCase(method) };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Return Modal ───
function ReturnModal({ event, isSubmitting, onConfirm, onCancel }: {
  event: CollectionEvent | null;
  isSubmitting: boolean;
  onConfirm: (data: { allocation_item_id: number; quantity_to_return: string; return_reason: string; item_condition: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('wrong_size');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');

  if (!event) return null;

  const selectedItem = event.items.find(item => item.allocation_item.toString() === selectedItemId);
  const maxReturn = selectedItem ? parseFloat(selectedItem.quantity_collected) : 0;

  const handleSubmit = () => {
    if (!selectedItemId || !quantity) return;
    onConfirm({
      allocation_item_id: parseInt(selectedItemId),
      quantity_to_return: quantity,
      return_reason: reason,
      item_condition: condition,
      notes: notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Undo2 className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-900">Return Items</h3>
          </div>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Select Item */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Item to Return</label>
            <select value={selectedItemId} onChange={e => { setSelectedItemId(e.target.value); setQuantity(''); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
              <option value="">Select item...</option>
              {event.items.map(item => (
                <option key={item.id} value={item.allocation_item}>
                  {item.item_name} — Collected: {item.quantity_collected}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          {selectedItem && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Quantity to Return <span className="text-slate-400 normal-case">(max: {maxReturn})</span>
              </label>
              <input
                type="number"
                min="0.01"
                max={maxReturn}
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {parseFloat(quantity) > maxReturn && (
                <p className="text-[10px] text-red-500 font-bold mt-1">Cannot return more than collected ({maxReturn})</p>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
              <option value="damaged">Damaged</option>
              <option value="wrong_size">Wrong Size</option>
              <option value="excess">Excess Quantity</option>
              <option value="duplicate">Duplicate Collection</option>
              <option value="student_left">Student Left School</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Item Condition</label>
            <select value={condition} onChange={e => setCondition(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>

          {/* No Refund Notice */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 font-medium">
              Note: Returns restore stock only. Wallet refunds only happen on allocation termination.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-200 bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !selectedItemId || !quantity || parseFloat(quantity) <= 0}
            className="px-6 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 shadow-md disabled:opacity-50 flex items-center gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Process Return
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Drawer ───
function CollectionDetailDrawer({ eventId, onClose, onReturn }: {
  eventId: number | null;
  onClose: () => void;
  onReturn: (event: CollectionEvent) => void;
}) {
  const [detail, setDetail] = useState<CollectionEvent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    collectionEventAPI.get(eventId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm flex justify-end animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-black text-slate-800 text-lg flex items-center">
            <FileText className="w-5 h-5 mr-2 text-cyan-600" /> Collection Details
          </h3>
          <button onClick={onClose} className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>
          ) : !detail ? (
            <p className="text-center py-16 text-sm text-slate-400 font-medium">Failed to load detail.</p>
          ) : (
            <>
              {/* Reference + Date */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</p>
                    <p className="text-sm font-bold text-slate-800">{detail.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-xs font-bold text-slate-600">{fmtDateTime(detail.collection_date)}</p>
                  </div>
                </div>
              </div>

              {/* Student */}
              <div className="flex items-center gap-3 p-4 bg-cyan-50 border border-cyan-100 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {toTitleCase(detail.student_name).charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{toTitleCase(detail.student_name)}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{detail.location_name}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Items Collected</h4>
                <div className="space-y-2">
                  {detail.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{item.item_name}</p>
                        <p className="text-[10px] text-slate-400">{item.unit_display} • {item.quantity_collected} collected</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-700">×{item.quantity_collected}</p>
                        <p className="text-[10px] font-black text-slate-600">{fmtMoney(item.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Total Quantity</span>
                  <span>{detail.total_quantity || detail.items.reduce((s, i) => s + parseFloat(i.quantity_collected), 0)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Payment Method</span>
                  <span className="uppercase">{detail.payment_method.replace('_', ' ')}</span>
                </div>
                <div className="h-px bg-white/10 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest">Total Amount</span>
                  <span className="text-lg font-black">{fmtMoney(detail.total_amount)}</span>
                </div>
              </div>

              {/* Staff */}
              <div className="text-[10px] text-slate-400 text-center">
                Processed by: <span className="font-bold text-slate-600">{detail.collected_by_staff_name || 'System'}</span>
              </div>
            </>
          )}
        </div>

        {/* Return Button */}
        {detail && (
          <div className="p-5 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => { onClose(); onReturn(detail); }}
              className="w-full py-3 bg-amber-600 text-white font-bold text-sm rounded-xl hover:bg-amber-700 flex items-center justify-center gap-2">
              <Undo2 className="h-4 w-4" /> Return Items
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ViewCollectionsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('inventory.view_inventoryassignmentmodel');

  const [events, setEvents] = useState<CollectionEventList[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [detailEventId, setDetailEventId] = useState<number | null>(null);
  const [returnEvent, setReturnEvent] = useState<CollectionEvent | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (paymentFilter) params.payment_method = paymentFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await collectionEventAPI.list(params);

      let results: CollectionEventList[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results?.data) {
        results = data.results.data;
        totalCount = data.count || results.length;
      } else if (data?.results) {
        results = data.results;
        totalCount = data.count || results.length;
      }

      setEvents(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [fetchData]);

  useEffect(() => {
    fetchData(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setSearch('');
    setPaymentFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageAmount = useMemo(() => events.reduce((s, e) => s + parseFloat(e.total_amount || '0'), 0), [events]);
  const pageQuantity = useMemo(() => events.reduce((s, e) => s + parseFloat(e.total_quantity || '0'), 0), [events]);

  const handleReturn = async (data: { allocation_item_id: number; quantity_to_return: string; return_reason: string; item_condition: string; notes: string }) => {
    setIsReturning(true);
    try {
      await collectionEventAPI.returnItem(data);
      showToast('success', 'Return processed successfully.');
      setReturnEvent(null);
      fetchData(page);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <CollectionDetailDrawer eventId={detailEventId} onClose={() => setDetailEventId(null)} onReturn={(e) => setReturnEvent(e)} />
      <ReturnModal event={returnEvent} isSubmitting={isReturning} onConfirm={handleReturn} onCancel={() => setReturnEvent(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-600 rounded-xl flex items-center justify-center shadow-md">
              <PackageCheck className="h-5 w-5 text-white" />
            </div>
            View Collections
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Collection event history — who collected what and when</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, student..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white">
            <option value="">All Payment Methods</option>
            <option value="student_wallet">Student Wallet</option>
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
          </select>

          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none" />

          <div className="flex gap-2">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none" />
            <button onClick={resetFilters} title="Reset filters"
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Total Collections</p>
          <p className="text-xl font-bold text-slate-800">{loading ? '—' : total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Page Amount</p>
          <p className="text-xl font-bold text-slate-800">{loading ? '—' : fmtMoney(pageAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Page Quantity</p>
          <p className="text-xl font-bold text-slate-800">{loading ? '—' : pageQuantity}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && events.length === 0 ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading collections...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchData(page)} className="text-sm text-cyan-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="h-7 w-7 text-cyan-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No collections found</h3>
            <p className="text-sm text-slate-400">Record a new collection to see it here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3 text-center">Items</th>
                    <th className="px-5 py-3 text-center">Qty</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {events.map(event => (
                    <tr key={event.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-[10px] text-slate-500">{event.reference}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {toTitleCase(event.student_name).charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{toTitleCase(event.student_name)}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{event.student_registration_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-xs font-bold text-slate-700">{event.total_items_count} Item{event.total_items_count !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-xs font-bold text-slate-700">{event.total_quantity}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-black text-slate-800">{fmtMoney(event.total_amount)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <PaymentBadge method={event.payment_method} />
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-slate-600">{fmtDate(event.collection_date)}</p>
                        <p className="text-[10px] text-slate-400">{new Date(event.collection_date).toLocaleTimeString('en-GB')}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setDetailEventId(event.id)} title="View Details"
                            className="p-1.5 rounded-lg text-cyan-600 bg-cyan-50 border border-cyan-100 hover:bg-cyan-100 transition-all">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> collection{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchData(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchData(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-cyan-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchData(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}