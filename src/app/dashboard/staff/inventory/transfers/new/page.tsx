// app/dashboard/staff/inventory/transfers/new/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryLocationAPI, stockTransferAPI } from '@/lib/api';
import { InventoryItemList, InventoryLocation } from '@/lib/types';
import {
  ArrowLeft, ArrowLeftRight, Save, X, Check, AlertCircle,
  Loader2, Search, ScanLine, Trash2, MapPin, Package, ArrowRight,
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
        .join(' ');
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
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : t.type === 'error'
            ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
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

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const cellInputCls = 'w-full px-2 py-1.5 border rounded-lg focus:ring-1 focus:ring-violet-500 outline-none text-xs bg-white';

interface CartItem extends InventoryItemList {
  quantity: string;
  available_qty: number; // stock at from_location specifically
}

export default function NewStockTransferPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({ from_location: '', to_location: '', notes: '' });
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItemList[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref so barcode handler always sees current from_location
  const fromLocationRef = useRef('');

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorystocktransfermodel');

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Load tracked locations once
  useEffect(() => {
    inventoryLocationAPI.list().then(data => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      setLocations(arr.filter(
        (l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'
      ));
    }).catch(() => {});
  }, []);

  // Keep ref in sync
  useEffect(() => { fromLocationRef.current = form.from_location; }, [form.from_location]);

  // When from_location changes, revalidate existing cart items
  useEffect(() => {
    if (!form.from_location || cart.length === 0) return;

    setIsRevalidating(true);
    Promise.all(
      cart.map(cartItem =>
        inventoryItemAPI.list({ search: cartItem.name, location: Number(form.from_location) })
          .then(res => {
            const results: InventoryItemList[] = Array.isArray(res) ? res : (res?.results ?? []);
            const match = results.find((r: InventoryItemList) => r.id === cartItem.id);
            const newAvail = match?.location_quantity ?? 0;
            return { id: cartItem.id, available_qty: newAvail };
          })
          .catch(() => ({ id: cartItem.id, available_qty: 0 }))
      )
    ).then(updates => {
      setCart(prev => prev.map(c => {
        const update = updates.find(u => u.id === c.id);
        if (!update) return c;
        const newAvail = update.available_qty;
        // Clamp quantity to new available if it exceeds
        const newQty = c.quantity && Number(c.quantity) > newAvail
          ? String(newAvail)
          : c.quantity;
        if (newAvail === 0) {
          showToast('error', `"${c.name}" has no stock at the selected location and was removed.`);
        } else if (c.quantity && Number(c.quantity) > newAvail) {
          showToast('error', `"${c.name}" quantity clamped to available stock (${newAvail}).`);
        }
        return { ...c, available_qty: newAvail, quantity: newQty };
      }));
      // Remove items with 0 availability
      setCart(prev => prev.filter(c => {
        const update = updates.find(u => u.id === c.id);
        return (update?.available_qty ?? 0) > 0;
      }));
    }).finally(() => setIsRevalidating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.from_location]);

  // Debounced item search — always pass from_location for location_quantity
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const params: any = { search: searchTerm };
        if (form.from_location) params.location = Number(form.from_location);
        const res = await inventoryItemAPI.list(params);
        const results = Array.isArray(res) ? res : (res?.results ?? []);
        setSearchResults(results);
        setShowResults(true);
      } catch {
        showToast('error', 'Failed to search items.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchTerm, form.from_location]);

  // Global barcode scanner
  useEffect(() => {
    let buffer = '';
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (timeout) clearTimeout(timeout);
      if (e.key === 'Enter') {
        if (buffer.length >= 4) handleBarcodeScan(buffer);
        buffer = '';
        return;
      }
      if (e.key.length === 1) buffer += e.key;
      timeout = setTimeout(() => {
        if (buffer.length >= 4) handleBarcodeScan(buffer);
        buffer = '';
      }, 100);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const handleBarcodeScan = async (barcode: string) => {
    showToast('info', `Scanned: ${barcode}. Searching...`);
    try {
      const params: any = { search: barcode };
      if (fromLocationRef.current) params.location = Number(fromLocationRef.current);
      const res = await inventoryItemAPI.list(params);
      const foundItems = Array.isArray(res) ? res : (res?.results ?? []);
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);
      if (exactMatch) addToCart(exactMatch);
      else showToast('error', `No item found for barcode: ${barcode}`);
    } catch {
      showToast('error', 'Error looking up barcode.');
    }
  };

  const addToCart = (item: InventoryItemList) => {
    if (cart.some(c => c.id === item.id)) {
      showToast('error', `'${item.name}' is already in the list.`);
      return;
    }
    const availQty = item.location_quantity ?? 0;
    if (form.from_location && availQty <= 0) {
      showToast('error', `'${item.name}' has no stock at the selected location.`);
      return;
    }
    setCart(prev => [...prev, { ...item, quantity: '', available_qty: availQty }]);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const handleCartChange = (id: number, value: string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      // Clamp to available
      if (value !== '' && item.available_qty > 0 && Number(value) > item.available_qty) {
        showToast('error', `Max available for "${item.name}" at this location is ${item.available_qty}.`);
        return { ...item, quantity: String(item.available_qty) };
      }
      return { ...item, quantity: value };
    }));
  };

  const handleRemoveItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const hasInvalidQty = cart.some(
    c => !c.quantity || Number(c.quantity) <= 0 || Number(c.quantity) > c.available_qty
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (!form.from_location) { setPageError('Please select a From location.'); return; }
    if (!form.to_location) { setPageError('Please select a To location.'); return; }
    if (form.from_location === form.to_location) {
      setPageError('From and To locations cannot be the same.');
      return;
    }
    if (cart.length === 0) { setPageError('Add at least one item to transfer.'); return; }
    if (hasInvalidQty) { setPageError('Fix invalid quantities before saving.'); return; }

    setIsSaving(true);
    try {
      const payload = {
        from_location: Number(form.from_location),
        to_location: Number(form.to_location),
        notes: form.notes,
        items: cart.map(c => ({ item: c.id, quantity: c.quantity })),
      };
      const created = await stockTransferAPI.create(payload);
      showToast('success', 'Transfer recorded successfully!');
      router.push(`/dashboard/staff/inventory/transfers/${created.id}`);
    } catch (err) {
      showToast('error', extractError(err));
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to manage transfers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/inventory/transfers')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            New Stock Transfer
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Move stock between tracked locations</p>
        </div>
      </div>

      <form id="transfer-form" onSubmit={handleSubmit} className="space-y-5">

        {/* ── Transfer Details ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Transfer Details</h3>
              <p className="text-xs text-slate-400">Set the source and destination locations</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-5">
              <div className="flex-1">
                <label className={labelCls}>From Location <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select
                    required
                    value={form.from_location}
                    onChange={e => setForm(prev => ({ ...prev, from_location: e.target.value }))}
                    className={`${inputCls} appearance-none pr-9`}
                  >
                    <option value="" disabled>Select source...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id} disabled={String(loc.id) === form.to_location}>
                        {loc.name} ({loc.location_type})
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-center px-2 pb-2.5 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-violet-600" />
                </div>
              </div>

              <div className="flex-1">
                <label className={labelCls}>To Location <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select
                    required
                    value={form.to_location}
                    onChange={e => setForm(prev => ({ ...prev, to_location: e.target.value }))}
                    className={`${inputCls} appearance-none pr-9`}
                  >
                    <option value="" disabled>Select destination...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id} disabled={String(loc.id) === form.from_location}>
                        {loc.name} ({loc.location_type})
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── Item Search & Cart ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Add Items</h3>
                <p className="text-xs text-slate-400">
                  {form.from_location
                    ? 'Showing stock available at selected source location'
                    : 'Select a From location first to see available stock'}
                </p>
              </div>
            </div>
            {isRevalidating && (
              <div className="flex items-center gap-2 text-xs text-violet-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Revalidating stock...
              </div>
            )}
          </div>

          <div className="p-6">
            {/* No location warning */}
            {!form.from_location && (
              <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Select a From location above before searching. Stock availability is location-specific.
                </p>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder={form.from_location ? 'Search items...' : 'Select source location first...'}
                disabled={!form.from_location}
                className={`${inputCls} pl-10 pr-10 ${!form.from_location ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-500" />
              )}
              {showResults && !isSearching && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {searchResults.length > 0 ? searchResults.map(item => {
                    const avail = item.location_quantity ?? 0;
                    const outOfStock = form.from_location && avail <= 0;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onMouseDown={() => !outOfStock && addToCart(item)}
                        disabled={!!outOfStock}
                        className={`w-full flex items-center justify-between gap-3 p-3 transition-colors text-left border-b border-slate-50 last:border-0
                          ${outOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {item.barcode || 'No barcode'} • {item.category_name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {form.from_location ? (
                            <span className={`text-xs font-bold ${avail > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {avail > 0 ? `${avail} available` : 'Out of stock'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Total: {Number(item.total_quantity).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="p-4 text-center text-sm text-slate-400">No items found.</div>
                  )}
                </div>
              )}
            </div>

            {/* Barcode tip */}
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3 mb-6 max-w-md">
              <ScanLine className="h-4 w-4 text-violet-500 flex-shrink-0" />
              <p className="text-xs text-violet-700">
                Click outside any input field and scan a barcode to add items instantly.
              </p>
            </div>

            {/* Cart */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <Package className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No items added yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use the search box or scanner above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Cart header */}
                <div
                  className="hidden sm:grid gap-4 px-3 pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 200px 2rem' }}
                >
                  <span>Item</span>
                  <span>Quantity to Transfer</span>
                  <span />
                </div>

                {cart.map(item => {
                  const qty = Number(item.quantity);
                  const exceedsMax = item.quantity !== '' && qty > item.available_qty;
                  const isEmpty = !item.quantity || qty <= 0;
                  const isInvalid = exceedsMax || isEmpty;

                  return (
                    <div
                      key={item.id}
                      className={`grid items-center gap-4 rounded-xl border px-4 py-3 transition-colors
                        ${exceedsMax ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-slate-50/40'}`}
                      style={{ gridTemplateColumns: '1fr 200px 2rem' }}
                    >
                      {/* Item info */}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{item.unit} • {item.category_name}</span>
                          <span className={`font-semibold ${item.available_qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {item.available_qty > 0
                              ? `${item.available_qty} available at source`
                              : 'None at source'}
                          </span>
                        </p>
                        {exceedsMax && (
                          <p className="text-[11px] text-red-600 font-medium mt-0.5">
                            Exceeds available stock ({item.available_qty})
                          </p>
                        )}
                      </div>

                      {/* Quantity input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={item.available_qty}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleCartChange(item.id, e.target.value)}
                          className={`${cellInputCls} flex-1
                            ${isEmpty ? 'border-orange-300 bg-orange-50' :
                              exceedsMax ? 'border-red-300 bg-red-50' :
                              'border-slate-200'}`}
                        />
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          / {item.available_qty}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
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

      {/* ── Fixed Bottom Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Items</p>
              <p className="text-lg font-bold text-slate-800">{cart.length}</p>
            </div>
            {form.from_location && form.to_location && form.from_location !== form.to_location && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-300" />
                <span className="font-medium text-slate-700">
                  {locations.find(l => String(l.id) === form.from_location)?.name ?? '—'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                <span className="font-medium text-slate-700">
                  {locations.find(l => String(l.id) === form.to_location)?.name ?? '—'}
                </span>
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
            <Link
              href="/dashboard/staff/inventory/transfers"
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              form="transfer-form"
              disabled={isSaving || cart.length === 0 || hasInvalidQty || isRevalidating}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all shadow-md shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : isRevalidating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking stock...</>
                : <><Save className="h-4 w-4" /> Save Transfer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}