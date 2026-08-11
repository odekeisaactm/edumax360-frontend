'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { stockInAPI, inventoryLocationAPI, inventoryItemAPI } from '@/lib/api';
import { StockIn, InventoryLocation, InventoryItem } from '@/lib/types';
import {
  PackagePlus, Plus, Search, X, AlertCircle, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, Eye, Building,
  MapPin, CalendarDays, ReceiptText, Check, Tag,
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

const SOURCE_COLORS: Record<string, string> = {
  purchase:   'bg-blue-50 text-blue-700 border-blue-100',
  return:     'bg-amber-50 text-amber-700 border-amber-100',
  adjustment: 'bg-violet-50 text-violet-700 border-violet-100',
  transfer:   'bg-teal-50 text-teal-700 border-teal-100',
  donation:   'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const SOURCE_LABELS: Record<string, string> = {
  purchase: 'Purchase', return: 'Return', adjustment: 'Adjustment',
  transfer: 'Transfer', donation: 'Donation',
};

const PAGE_SIZE = 20;

export default function StockInListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const [batches, setBatches] = useState<StockIn[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<number | ''>('');
  const [locations, setLocations] = useState<InventoryLocation[]>([]);

  // Item Autocomplete Filters
  const [selectedItem, setSelectedItem] = useState<{ id: number; name: string } | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorystockinmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchBatches = useCallback(async (search: string, location: number | '', itemId: number | undefined, pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (location) params.location = location;
      if (itemId) params.item = itemId;

      const data = await stockInAPI.list(params);

      let results: StockIn[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results && Array.isArray(data.results)) {
        results = data.results;
        totalCount = data.count || results.length;
      } else if (data?.results?.data) {
        results = data.results.data;
        totalCount = data.count || results.length;
      }

      setBatches(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Initial Load: Check for ?item= in URL
  useEffect(() => {
    const urlItemId = searchParams.get('item');
    if (urlItemId) {
      // Fetch the item's name to display in the filter badge
      inventoryItemAPI.get(Number(urlItemId))
        .then((itemData: InventoryItem) => {
          setSelectedItem({ id: itemData.id, name: itemData.name });
          fetchBatches('', '', itemData.id, 1);
        })
        .catch(() => {
          showToast('error', 'Could not load filtered item details.');
          fetchBatches('', '', undefined, 1);
        });
    } else {
      fetchBatches('', '', undefined, 1);
    }

    // Load locations
    inventoryLocationAPI.list().then(data => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      setLocations(arr.filter((l: InventoryLocation) => l.location_type !== 'generic'));
    }).catch(() => {});
  }, []); // Run once on mount

  // 2. Debounce table search
  useEffect(() => {
    // Skip if loading initially via URL param to prevent double fetch
    if (loading && page === 1 && !pendingSearch) return;

    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch, selectedLocation, selectedItem]);

  // 3. Debounce Item Autocomplete Search
  useEffect(() => {
    if (itemSearchDebounce.current) clearTimeout(itemSearchDebounce.current);
    if (itemSearchQuery.length < 2) {
      setItemOptions([]);
      setIsSearchingItems(false);
      return;
    }

    setIsSearchingItems(true);
    itemSearchDebounce.current = setTimeout(async () => {
      try {
        const res = await inventoryItemAPI.list({ search: itemSearchQuery, page_size: 10 });
        const items = Array.isArray(res) ? res : (res?.results?.data || res?.results || []);
        setItemOptions(items);
        setIsItemDropdownOpen(true);
      } catch (e) {
        console.error("Failed to search items", e);
      } finally {
        setIsSearchingItems(false);
      }
    }, 300);

    return () => { if (itemSearchDebounce.current) clearTimeout(itemSearchDebounce.current); };
  }, [itemSearchQuery]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stat counts derived from current page
  const purchaseCount = batches.filter(b => b.source === 'purchase').length;
  const adjustmentCount = batches.filter(b => b.source === 'adjustment').length;

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <PackagePlus className="h-5 w-5 text-white" />
            </div>
            Stock In History
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">All goods received into inventory locations</p>
        </div>
        {canManage && (
          <button
            onClick={() => router.push('/dashboard/staff/inventory/stock-in/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md shadow-emerald-200"
          >
            <Plus className="h-4 w-4" /> New Stock In
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Batches', value: total, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100' },
          { label: 'Purchases (Page)', value: purchaseCount, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-100' },
          { label: 'Adjustments (Page)', value: adjustmentCount, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-100' },
          { label: 'This Page', value: batches.length, color: 'from-slate-500 to-slate-600', shadow: 'shadow-slate-100' },
        ].map(({ label, value, color, shadow }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${shadow}`}>
              <PackagePlus className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

            {/* Global Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by receipt or supplier..."
                value={pendingSearch}
                onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Item Filter (Autocomplete) */}
            <div className="relative flex-1 w-full z-10">
              {selectedItem ? (
                <div className="flex items-center justify-between w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Tag className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="truncate font-medium">{selectedItem.name}</span>
                  </div>
                  <button onClick={() => { setSelectedItem(null); setItemSearchQuery(''); }}
                    className="p-0.5 hover:bg-emerald-200 rounded-md transition-colors flex-shrink-0 ml-2">
                    <X className="h-3.5 w-3.5 text-emerald-600" />
                  </button>
                </div>
              ) : (
                <>
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by product..."
                    value={itemSearchQuery}
                    onChange={e => setItemSearchQuery(e.target.value)}
                    onFocus={() => { if (itemOptions.length > 0) setIsItemDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setIsItemDropdownOpen(false), 200)}
                    className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                  {isSearchingItems && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}

                  {isItemDropdownOpen && itemOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1">
                      {itemOptions.map((opt: any) => (
                        <button
                          key={opt.id}
                          onMouseDown={() => {
                            setSelectedItem({ id: opt.id, name: opt.name });
                            setIsItemDropdownOpen(false);
                            setItemSearchQuery('');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-800 truncate">{opt.name}</p>
                          {opt.barcode && <p className="text-[10px] text-slate-400 font-mono">{opt.barcode}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Location Dropdown */}
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value ? Number(e.target.value) : '')}
              className="px-3.5 py-2 w-full sm:w-auto text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.location_type})
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, page)}
              title="Refresh"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors hidden sm:block flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading batches...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, 1)}
              className="text-sm text-emerald-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PackagePlus className="h-7 w-7 text-emerald-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No stock-in records found</h3>
            <p className="text-sm text-slate-400 mb-5">
              {pendingSearch || selectedItem ? 'Try adjusting your search or filters.' : 'Record your first stock receipt to get started.'}
            </p>
            {!pendingSearch && !selectedItem && canManage && (
              <button
                onClick={() => router.push('/dashboard/staff/inventory/stock-in/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200"
              >
                <Plus className="h-4 w-4" /> New Stock In
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 120px 140px 160px 100px 56px' }}
            >
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Receipt</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier / PO</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</span>
            </div>

            <div className="divide-y divide-slate-50">
              {batches.map(batch => (
                <div
                  key={batch.id}
                  className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1fr 120px 140px 160px 100px 56px' }}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <ReceiptText className="h-4 w-4 text-emerald-600" />
                  </div>

                  {/* Receipt */}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm font-mono truncate">{batch.receipt_number}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {batch.items?.length ?? 0} line item{batch.items?.length !== 1 ? 's' : ''}
                      {batch.total_cost ? ` · ₦${Number(batch.total_cost).toLocaleString()}` : ''}
                    </p>
                  </div>

                  {/* Source badge */}
                  <div className="hidden sm:block">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${SOURCE_COLORS[batch.source] ?? 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                      {SOURCE_LABELS[batch.source] ?? batch.source}
                    </span>
                  </div>

                  {/* Supplier / PO */}
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <Building className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">
                      {batch.supplier_name ?? '—'}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{batch.location_name ?? '—'}</span>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600">
                      {new Date(batch.date_received).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => router.push(`/dashboard/staff/inventory/stock-in/${batch.id}`)}
                      title="View"
                      className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> batch{total !== 1 ? 'es' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchBatches(pendingSearch, selectedLocation, selectedItem?.id, page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
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