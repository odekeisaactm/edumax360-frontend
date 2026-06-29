// app/dashboard/staff/inventory/stock-out/new/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryLocationAPI, stockOutAPI } from '@/lib/api';
import { InventoryItemList, InventoryLocation, StockOutReason, StockOutDepartment } from '@/lib/types';
import {
  ArrowLeft, PackageMinus, Save, X, Check, AlertCircle, Loader2,
  Search, ScanLine, Trash2, MapPin, Package, User,
} from 'lucide-react';
import api from '@/lib/api';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }
interface StaffResult { id: number; full_name: string; staff_id?: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details).map(([, v]) => (Array.isArray(v) ? v[0] : String(v))).join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
            'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : t.type === 'error' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
            : <ScanLine className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const cellInputCls = 'w-full px-2 py-1.5 border rounded-lg focus:ring-1 focus:ring-rose-500 outline-none text-xs bg-white';

const REASONS: { value: StockOutReason; label: string }[] = [
  { value: 'staff_collection', label: 'Staff Collection' },
  { value: 'damage', label: 'Damage' },
  { value: 'expired', label: 'Expired' },
  { value: 'adjustment', label: 'Stock Adjustment' },
  { value: 'wastage', label: 'Wastage' },
  { value: 'transfer', label: 'Transfer to Station' },
  { value: 'disbursement', label: 'Disbursement' },
];

const DEPARTMENTS: { value: StockOutDepartment; label: string }[] = [
  { value: 'cleaning', label: 'Cleaning & Sanitation' },
  { value: 'drivers', label: 'Drivers' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'admin', label: 'Admin' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'maintenance', label: 'Maintenance' },
];

interface CartItem extends InventoryItemList {
  quantity_removed: string;
  available_qty: number;
}

export default function NewStockOutPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({
    location: '',
    reason: '' as StockOutReason | '',
    department: '' as StockOutDepartment | '',
    destination_location: '',
    notes: '',
  });

  const [selectedStaff, setSelectedStaff] = useState<StaffResult | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);
  const [showStaffResults, setShowStaffResults] = useState(false);
  const [isSearchingStaff, setIsSearchingStaff] = useState(false);

  const [trackedLocations, setTrackedLocations] = useState<InventoryLocation[]>([]);
  const [genericLocations, setGenericLocations] = useState<InventoryLocation[]>([]);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<InventoryItemList[]>([]);
  const [showItemResults, setShowItemResults] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const itemSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemSearchInputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef('');

  const canManage = user?.is_superuser || hasPermission('inventory.add_stockoutmodel');

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const isStaffCollection = form.reason === 'staff_collection';
  const isTransfer = form.reason === 'transfer';

  // Load locations
  useEffect(() => {
    inventoryLocationAPI.list().then(data => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      setTrackedLocations(arr.filter((l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'));
      setGenericLocations(arr.filter((l: InventoryLocation) => l.location_type === 'generic'));
    }).catch(() => {});
  }, []);

  useEffect(() => { locationRef.current = form.location; }, [form.location]);

  // Revalidate cart when location changes
  useEffect(() => {
    if (!form.location || cart.length === 0) return;
    setIsRevalidating(true);

    Promise.all(
      cart.map(cartItem =>
        inventoryItemAPI.list({ search: cartItem.name, location: Number(form.location) })
          .then(res => {
            const results: InventoryItemList[] = Array.isArray(res) ? res : (res?.results ?? []);
            const match = results.find((r: InventoryItemList) => r.id === cartItem.id);
            return { id: cartItem.id, name: cartItem.name, available_qty: match?.location_quantity ?? 0 };
          })
          .catch(() => ({ id: cartItem.id, name: cartItem.name, available_qty: 0 }))
      )
    ).then(updates => {
      const removed: string[] = [];
      const clamped: string[] = [];

      setCart(prev => {
        const next = prev.map(c => {
          const u = updates.find(x => x.id === c.id);
          if (!u) return c;
          if (u.available_qty === 0) { removed.push(c.name); return null; }
          const newQty = c.quantity_removed && Number(c.quantity_removed) > u.available_qty
            ? String(u.available_qty) : c.quantity_removed;
          if (c.quantity_removed && Number(c.quantity_removed) > u.available_qty) clamped.push(c.name);
          return { ...c, available_qty: u.available_qty, quantity_removed: newQty };
        }).filter(Boolean) as CartItem[];
        return next;
      });

      if (removed.length) showToast('error', `Removed (no stock at location): ${removed.join(', ')}`);
      if (clamped.length) showToast('error', `Quantity clamped to available: ${clamped.join(', ')}`);
    }).finally(() => setIsRevalidating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location]);

  // Staff search
  useEffect(() => {
    if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current);
    if (staffSearch.trim().length < 2) { setStaffResults([]); setShowStaffResults(false); return; }
    setIsSearchingStaff(true);
    staffSearchDebounce.current = setTimeout(async () => {
      try {
        const r = await api.get('/api/human-resource/staff/', { params: { search: staffSearch, page_size: 10 } });
        const data = r?.data;
        let results: any[] = [];
        if (data?.success && Array.isArray(data.data)) results = data.data;
        else if (data?.results?.data && Array.isArray(data.results.data)) results = data.results.data;
        else if (data?.results && Array.isArray(data.results)) results = data.results;
        setStaffResults(results.map((s: any) => ({
          id: s.id,
          full_name: s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
          staff_id: s.staff_id,
        })));
        setShowStaffResults(true);
      } catch { showToast('error', 'Failed to search staff.'); }
      finally { setIsSearchingStaff(false); }
    }, 300);
    return () => { if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current); };
  }, [staffSearch]);

  // Item search
  useEffect(() => {
    if (itemSearchDebounce.current) clearTimeout(itemSearchDebounce.current);
    if (itemSearch.trim().length < 2) { setItemResults([]); setShowItemResults(false); return; }
    setIsSearchingItems(true);
    itemSearchDebounce.current = setTimeout(async () => {
      try {
        const params: any = { search: itemSearch };
        if (form.location) params.location = Number(form.location);
        const res = await inventoryItemAPI.list(params);
        const results = Array.isArray(res) ? res : (res?.results ?? []);
        setItemResults(results);
        setShowItemResults(true);
      } catch { showToast('error', 'Failed to search items.'); }
      finally { setIsSearchingItems(false); }
    }, 300);
    return () => { if (itemSearchDebounce.current) clearTimeout(itemSearchDebounce.current); };
  }, [itemSearch, form.location]);

  // Barcode scanner
  useEffect(() => {
    let buffer = '';
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (timeout) clearTimeout(timeout);
      if (e.key === 'Enter') { if (buffer.length >= 4) handleBarcodeScan(buffer); buffer = ''; return; }
      if (e.key.length === 1) buffer += e.key;
      timeout = setTimeout(() => { if (buffer.length >= 4) handleBarcodeScan(buffer); buffer = ''; }, 100);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const handleBarcodeScan = async (barcode: string) => {
    if (!locationRef.current) { showToast('error', 'Select a location before scanning.'); return; }
    showToast('info', `Scanned: ${barcode}. Searching...`);
    try {
      const params: any = { search: barcode };
      if (locationRef.current) params.location = Number(locationRef.current);
      const res = await inventoryItemAPI.list(params);
      const foundItems = Array.isArray(res) ? res : (res?.results ?? []);
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);
      if (exactMatch) addToCart(exactMatch);
      else showToast('error', `No item found for barcode: ${barcode}`);
    } catch { showToast('error', 'Error looking up barcode.'); }
  };

  const addToCart = (item: InventoryItemList) => {
    if (!form.location) { showToast('error', 'Select a location before adding items.'); return; }
    if (cart.some(c => c.id === item.id)) { showToast('error', `'${item.name}' is already in the list.`); return; }
    const availQty = item.location_quantity ?? 0;
    if (availQty <= 0) { showToast('error', `'${item.name}' has no stock at the selected location.`); return; }
    setCart(prev => [...prev, { ...item, quantity_removed: '', available_qty: availQty }]);
    setItemSearch(''); setItemResults([]); setShowItemResults(false);
    itemSearchInputRef.current?.focus();
  };

  // Allow over-max entry — just mark invalid visually, no silent clamping
  const handleCartChange = (id: number, value: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity_removed: value } : item));
  };

  const handleRemoveItem = (id: number) => setCart(prev => prev.filter(item => item.id !== id));

  const hasInvalidQty = cart.some(c => {
    const qty = Number(c.quantity_removed);
    if (!c.quantity_removed || qty <= 0) return true;
    if (form.location && c.available_qty > 0 && qty > c.available_qty) return true;
    return false;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);
    if (!form.location) { setPageError('Please select a location.'); return; }
    if (!form.reason) { setPageError('Please select a reason.'); return; }
    if (isStaffCollection && !selectedStaff) { setPageError('Please select a staff member.'); return; }
    if (isTransfer && !form.destination_location) { setPageError('Please select a destination location.'); return; }
    if (cart.length === 0) { setPageError('Add at least one item.'); return; }
    if (hasInvalidQty) { setPageError('Fix invalid quantities before saving.'); return; }

    setIsSaving(true);
    try {
      await Promise.all(cart.map(item => {
        const payload: any = {
          item: item.id,
          location: Number(form.location),
          quantity_removed: item.quantity_removed,
          reason: form.reason,
          notes: form.notes || null,
        };
        if (form.department) payload.department = form.department;
        if (selectedStaff) payload.staff_recipient = selectedStaff.id;
        if (isTransfer && form.destination_location) payload.destination_location = Number(form.destination_location);
        return stockOutAPI.create(payload);
      }));
      showToast('success', `${cart.length} stock out record${cart.length !== 1 ? 's' : ''} saved.`);
      router.push('/dashboard/staff/inventory/stock-out');
    } catch (err) {
      showToast('error', extractError(err));
      setIsSaving(false);
    }
  };

  if (!canManage) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <p className="font-bold text-slate-800 mb-1">Access Denied</p>
        <p className="text-sm text-slate-400">You don't have permission to manage stock.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/staff/inventory/stock-out')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-md shadow-rose-200">
              <PackageMinus className="h-5 w-5 text-white" />
            </div>
            New Stock Out
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Record stock removed from inventory</p>
        </div>
      </div>

      <form id="stock-out-form" onSubmit={handleSubmit} className="space-y-5">

        {/* Details card — no overflow-hidden so dropdowns escape */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 rounded-t-2xl">
            <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <PackageMinus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Stock Out Details</h3>
              <p className="text-xs text-slate-400">Set location, reason, and any additional context</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Row 1: Location + Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Location <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select required value={form.location}
                    onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                    className={`${inputCls} appearance-none pr-9`}>
                    <option value="" disabled>Select location...</option>
                    {trackedLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                    ))}
                  </select>
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Reason <span className="text-red-400 normal-case">*</span></label>
                <select required value={form.reason}
                  onChange={e => {
                    setForm(prev => ({ ...prev, reason: e.target.value as StockOutReason, destination_location: '', department: '' }));
                    setSelectedStaff(null); setStaffSearch('');
                  }}
                  className={inputCls}>
                  <option value="" disabled>Select reason...</option>
                  {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {/* Department + Notes — show once reason is set */}
            {form.reason && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Department <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <select value={form.department}
                    onChange={e => setForm(prev => ({ ...prev, department: e.target.value as StockOutDepartment }))}
                    className={inputCls}>
                    <option value="">None</option>
                    {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input type="text" value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes..." className={inputCls} />
                </div>
              </div>
            )}

            {/* Staff search — staff_collection only */}
            {isStaffCollection && (
              <div>
                <label className={labelCls}>Staff Member <span className="text-red-400 normal-case">*</span></label>
                {selectedStaff ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl max-w-md">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 truncate">{selectedStaff.full_name}</p>
                      {selectedStaff.staff_id && <p className="text-xs text-blue-600">{selectedStaff.staff_id}</p>}
                    </div>
                    <button type="button" onClick={() => { setSelectedStaff(null); setStaffSearch(''); }}
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // z-[60] on dropdown so it sits above everything, no overflow clip on parent
                  <div className="relative max-w-md">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                    <input type="text" value={staffSearch}
                      onChange={e => setStaffSearch(e.target.value)}
                      onFocus={() => staffSearch.length >= 2 && setShowStaffResults(true)}
                      onBlur={() => setTimeout(() => setShowStaffResults(false), 200)}
                      placeholder="Type staff name to search..."
                      className={`${inputCls} pl-10 pr-10`} />
                    {isSearchingStaff && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-rose-500" />
                    )}
                    {showStaffResults && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl z-[60] max-h-56 overflow-y-auto">
                        {isSearchingStaff ? (
                          <div className="p-4 text-center">
                            <Loader2 className="h-4 w-4 animate-spin text-rose-500 mx-auto" />
                          </div>
                        ) : staffResults.length > 0 ? staffResults.map(s => (
                          <button type="button" key={s.id}
                            onMouseDown={() => { setSelectedStaff(s); setStaffSearch(''); setShowStaffResults(false); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name}</p>
                              {s.staff_id && <p className="text-xs text-slate-400">{s.staff_id}</p>}
                            </div>
                          </button>
                        )) : (
                          <div className="p-4 text-center text-sm text-slate-400">No staff found.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Destination — transfer only */}
            {isTransfer && (
              <div>
                <label className={labelCls}>Destination Station <span className="text-red-400 normal-case">*</span></label>
                {genericLocations.length > 0 ? (
                  <div className="relative max-w-md">
                    <select required={isTransfer} value={form.destination_location}
                      onChange={e => setForm(prev => ({ ...prev, destination_location: e.target.value }))}
                      className={`${inputCls} appearance-none pr-9`}>
                      <option value="" disabled>Select destination station...</option>
                      {genericLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl max-w-md">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700">No generic/station locations found. Add them in Location settings first.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Item search & cart — also no overflow-hidden */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Add Items</h3>
                <p className="text-xs text-slate-400">
                  {form.location ? 'Showing stock at selected location' : 'Select a location first for accurate stock levels'}
                </p>
              </div>
            </div>
            {isRevalidating && (
              <div className="flex items-center gap-2 text-xs text-rose-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Revalidating stock...
              </div>
            )}
          </div>

          <div className="p-6">
            {!form.location && (
              <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Select a location above for accurate available stock levels.</p>
              </div>
            )}

            {/* Item search — z-[60] dropdown */}
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
              <input ref={itemSearchInputRef} type="text" value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                onFocus={() => itemSearch.length >= 2 && setShowItemResults(true)}
                onBlur={() => setTimeout(() => setShowItemResults(false), 200)}
                placeholder="Search inventory items..."
                className={`${inputCls} pl-10 pr-10`} />
              {isSearchingItems && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-rose-500" />
              )}
              {showItemResults && (
                <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl z-[60] max-h-72 overflow-y-auto">
                  {isSearchingItems ? (
                    <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin text-rose-500 mx-auto" /></div>
                  ) : itemResults.length > 0 ? itemResults.map(item => {
                    const avail = form.location ? (item.location_quantity ?? 0) : Number(item.total_quantity);
                    const outOfStock = !!form.location && avail <= 0;
                    return (
                      <button type="button" key={item.id}
                        onMouseDown={() => !outOfStock && addToCart(item)}
                        disabled={outOfStock}
                        className={`w-full flex items-center justify-between gap-3 p-3 transition-colors text-left border-b border-slate-50 last:border-0
                          ${outOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-400 truncate">{item.barcode || 'No barcode'} • {item.category_name}</p>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${avail > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {form.location ? (avail > 0 ? `${avail} avail.` : 'Out of stock') : `Total: ${Number(item.total_quantity).toFixed(0)}`}
                        </span>
                      </button>
                    );
                  }) : <div className="p-4 text-center text-sm text-slate-400">No items found.</div>}
                </div>
              )}
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-3 mb-6 max-w-md">
              <ScanLine className="h-4 w-4 text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-700">Click outside any input and scan a barcode to add items instantly.</p>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <Package className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No items added yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid gap-4 px-3 pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 200px 2rem' }}>
                  <span>Item</span><span>Quantity to Remove</span><span />
                </div>

                {cart.map(item => {
                  const qty = Number(item.quantity_removed);
                  const maxAvail = form.location ? item.available_qty : Number(item.total_quantity);
                  const exceedsMax = item.quantity_removed !== '' && maxAvail > 0 && qty > maxAvail;
                  const isEmpty = !item.quantity_removed || qty <= 0;
                  return (
                    <div key={item.id}
                      className={`grid items-start gap-4 rounded-xl border px-4 py-3 transition-colors
                        ${exceedsMax ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-slate-50/40'}`}
                      style={{ gridTemplateColumns: '1fr 200px 2rem' }}>

                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>{item.unit} • {item.category_name}</span>
                          {form.location && (
                            <span className={`font-semibold ${maxAvail > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {maxAvail > 0 ? `${maxAvail} available` : 'None at location'}
                            </span>
                          )}
                        </p>
                        {exceedsMax && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            Exceeds available stock ({maxAvail})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input type="number" step="1" min="1" placeholder="Qty"
                          value={item.quantity_removed}
                          onChange={e => handleCartChange(item.id, e.target.value)}
                          className={`${cellInputCls} flex-1
                            ${isEmpty ? 'border-orange-300 bg-orange-50' :
                              exceedsMax ? 'border-red-400 bg-red-50' :
                              'border-slate-200'}`} />
                        {form.location && maxAvail > 0 && (
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">/ {maxAvail}</span>
                        )}
                      </div>

                      <button type="button" onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 mt-0.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Items</p>
              <p className="text-lg font-bold text-slate-800">{cart.length}</p>
            </div>
            {form.reason && (
              <div className="hidden sm:block">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Reason</p>
                <p className="text-sm font-semibold text-slate-700">{REASONS.find(r => r.value === form.reason)?.label}</p>
              </div>
            )}
            {pageError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 max-w-xs">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600">{pageError}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/staff/inventory/stock-out"
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </Link>
            <button type="submit" form="stock-out-form"
              disabled={isSaving || cart.length === 0 || hasInvalidQty || isRevalidating}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-bold rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-md shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : isRevalidating ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking stock...</>
                : <><Save className="h-4 w-4" /> Save Stock Out</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}