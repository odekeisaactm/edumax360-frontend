// app/dashboard/staff/inventory/stock-in/new/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryLocationAPI, inventorySupplierAPI, stockInAPI } from '@/lib/api';
// Note: inventoryItemAPI is still used for item search
import { InventoryItemList, InventoryLocation, InventorySupplier, StockInSource } from '@/lib/types';
import {
  ArrowLeft, Package, Save, X, Check, AlertCircle, Loader2,
  Search, ScanLine, Trash2, MapPin, Building, CalendarDays, ClipboardList, Pencil,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// ─── UI Constants ──────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const cellInputCls = 'w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-xs bg-white';

interface CartItem extends InventoryItemList {
  quantity_received: string;
  unit_cost: string;
  batch_number: string;
  expiry_date: string;
  new_selling_price: string;
  price_changed: boolean;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NewStockInPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({
    source: 'purchase' as StockInSource,
    location: '',
    supplier: '',
    notes: '',
  });

  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItemList[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorystockinmodel');

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    Promise.all([
      inventoryLocationAPI.list(),
      inventorySupplierAPI.list(),
    ]).then(([locsData, supsData]) => {
      const locsArr = Array.isArray(locsData) ? locsData : (locsData?.results ?? []);
      const supsArr = Array.isArray(supsData) ? supsData : (supsData?.results ?? []);

      setLocations(locsArr.filter(
        (l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'
      ));
      setSuppliers(supsArr);
    }).catch(() => {});
  }, []);

  // Debounced item search
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
        const res = await inventoryItemAPI.list({ search: searchTerm, page_size: 10 });
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
  }, [searchTerm]);

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
  }, [cart]);

  const handleBarcodeScan = async (barcode: string) => {
    showToast('info', `Scanned: ${barcode}. Searching...`);
    try {
      const res = await inventoryItemAPI.list({ search: barcode, page_size: 5 });
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
    setCart(prev => [
      ...prev,
      {
        ...item,
        quantity_received: '',           // blank — user must fill in
        unit_cost: item.last_cost_price ? String(item.last_cost_price) : '',
        batch_number: '',
        expiry_date: '',
        new_selling_price: String(item.current_selling_price),
        price_changed: false,
      },
    ]);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const handleCartChange = (id: number, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalCost = cart.reduce(
    (sum, item) => sum + (Number(item.quantity_received) * Number(item.unit_cost)), 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (!form.location) { setPageError('Please select a location.'); return; }
    if (cart.length === 0) { setPageError('Add at least one item.'); return; }

    // Validate quantities
    const invalidItem = cart.find(c => !c.quantity_received || Number(c.quantity_received) <= 0);
    if (invalidItem) {
      setPageError(`Quantity for "${invalidItem.name}" must be greater than 0.`);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        source: form.source,
        location: Number(form.location),
        supplier: form.supplier ? Number(form.supplier) : null,
        notes: form.notes,
        items: cart.map(c => ({
          item: c.id,
          quantity_received: c.quantity_received,
          unit_cost: c.unit_cost,
          batch_number: c.batch_number || null,
          expiry_date: c.expiry_date || null,
        })),
        price_updates: cart
          .filter(c => c.price_changed && c.new_selling_price)
          .map(c => ({
            item_id: c.id,
            new_selling_price: c.new_selling_price,
          })),
      };

      const created = await stockInAPI.create(payload as any);
      showToast('success', 'Stock In batch saved successfully!');
      router.push(`/dashboard/staff/inventory/stock-in/${created.id}`);
    } catch (err) {
      setPageError(extractError(err));
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
          <p className="text-sm text-slate-400">You don't have permission to manage stock.</p>
        </div>
      </div>
    );
  }

  return (
    // Extra bottom padding so the fixed bar doesn't overlap content
    <div className="max-w-7xl mx-auto space-y-5 pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/inventory/stock-in')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            New Stock In Batch
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Receive inventory items into a location</p>
        </div>
      </div>

      <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-5">

        {/* ── Batch Details ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Batch Details</h3>
              <p className="text-xs text-slate-400">Metadata for this stock receipt</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelCls}>Source <span className="text-red-400 normal-case">*</span></label>
              <select
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value as StockInSource })}
                className={inputCls}
              >
                <option value="purchase">Purchase</option>
                <option value="return">Return</option>
                <option value="adjustment">Adjustment</option>
                <option value="donation">Donation</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Location <span className="text-red-400 normal-case">*</span></label>
              <div className="relative">
                <select
                  required
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  <option value="" disabled>Select Location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                  ))}
                </select>
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Supplier (Optional)</label>
              <div className="relative">
                <select
                  value={form.supplier}
                  onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  <option value="">None</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
                <Building className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── Item Search & Cart ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Add Items</h3>
              <p className="text-xs text-slate-400">Search by name or scan barcode</p>
            </div>
          </div>

          <div className="p-6">
            {/* Search Input */}
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder="Search inventory items..."
                className={`${inputCls} pl-10 pr-10`}
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
              )}

              {showResults && !isSearching && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {searchResults.length > 0 ? searchResults.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onMouseDown={() => addToCart(item)}
                      className="w-full flex items-center justify-between gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400 truncate">{item.barcode || 'No barcode'} • {item.category_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-slate-700">₦{Number(item.current_selling_price).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">Stock: {Number(item.total_quantity).toFixed(0)}</p>
                      </div>
                    </button>
                  )) : (
                    <div className="p-4 text-center text-sm text-slate-400">No items found.</div>
                  )}
                </div>
              )}
            </div>

            {/* Barcode tip */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 mb-6 max-w-md">
              <ScanLine className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700">
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
              <div className="space-y-3">
                {/* Cart header */}
                <div className="hidden md:grid gap-2 px-3 pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr 2rem' }}>
                  <span>Item</span>
                  <span>Qty Received</span>
                  <span>Cost Price (₦)</span>
                  <span>Sell Price (₦)</span>
                  <span>Batch No.</span>
                  <span>Expiry Date</span>
                  <span></span>
                </div>

                {cart.map(item => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                    {/* Row 1: Item name + primary fields */}
                    <div className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr 2rem' }}>

                      {/* Item name */}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400">{item.unit} • {item.category_name}</p>
                      </div>

                      {/* Quantity */}
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Qty"
                        value={item.quantity_received}
                        onChange={e => handleCartChange(item.id, 'quantity_received', e.target.value)}
                        className={`${cellInputCls} ${!item.quantity_received ? 'border-orange-300 bg-orange-50' : ''}`}
                      />

                      {/* Cost price */}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Cost"
                        value={item.unit_cost}
                        onChange={e => handleCartChange(item.id, 'unit_cost', e.target.value)}
                        className={cellInputCls}
                      />

                      {/* Selling price — locked unless checkbox ticked */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.new_selling_price}
                          onChange={e => handleCartChange(item.id, 'new_selling_price', e.target.value)}
                          disabled={!item.price_changed}
                          className={`${cellInputCls} ${item.price_changed ? 'border-amber-400 bg-amber-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        />
                        <label
                          title="Price changed? Tick to edit"
                          className="flex items-center cursor-pointer flex-shrink-0"
                        >
                          <input
                            type="checkbox"
                            checked={item.price_changed}
                            onChange={e => handleCartChange(item.id, 'price_changed', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${item.price_changed ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
                            {item.price_changed && <Pencil className="h-3 w-3 text-white" />}
                          </div>
                        </label>
                      </div>

                      {/* Batch number */}
                      <input
                        type="text"
                        placeholder="Batch"
                        value={item.batch_number}
                        onChange={e => handleCartChange(item.id, 'batch_number', e.target.value)}
                        className={cellInputCls}
                      />

                      {/* Expiry date */}
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={e => handleCartChange(item.id, 'expiry_date', e.target.value)}
                        className={cellInputCls}
                      />

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Price changed notice */}
                    {item.price_changed && (
                      <p className="mt-2 text-[11px] text-amber-600 font-medium pl-1">
                        ⚠ Selling price will be updated from ₦{Number(item.current_selling_price).toLocaleString()} → ₦{Number(item.new_selling_price).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* ── Fixed Bottom Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">

          {/* Left: stats + error */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Items</p>
              <p className="text-lg font-bold text-slate-800">{cart.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Total Cost</p>
              <p className="text-lg font-bold text-blue-600">
                ₦{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {pageError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 max-w-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs">{pageError}</span>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/staff/inventory/stock-in"
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              form="stock-in-form"
              disabled={isSaving || cart.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : <><Save className="h-4 w-4" /> Save Stock In</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}