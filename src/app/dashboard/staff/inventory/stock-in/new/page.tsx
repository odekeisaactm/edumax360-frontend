// app/dashboard/staff/inventory/stock-in/new/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryLocationAPI, inventorySupplierAPI, stockInAPI } from '@/lib/api';
import { InventoryItemList, InventoryLocation, InventorySupplier, StockInSource } from '@/lib/types';
import {
  ArrowLeft, Package, Save, X, Check, AlertCircle, Loader2,
  Search, ScanLine, Trash2, MapPin, Building, Plus, CalendarDays, ClipboardList,
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
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
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

interface CartItem extends InventoryItemList {
  quantity_received: string;
  unit_cost: string;
  batch_number: string;
  expiry_date: string;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NewStockInPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({
    source: 'purchase' as StockInSource,
    location: '',
    supplier: '',
    date_received: new Date().toISOString().split('T')[0],
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

  const canManage = user?.is_superuser || hasPermission('inventory.add_stockinmodel');

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    Promise.all([
      inventoryLocationAPI.list(),
      inventorySupplierAPI.list()
    ]).then(([locsData, supsData]) => {
      // FILTER OUT GENERIC LOCATIONS - Stock In only goes to tracked locations
      const trackedLocs = (Array.isArray(locsData) ? locsData : []).filter(
        (l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'
      );
      setLocations(trackedLocs);
      setSuppliers(Array.isArray(supsData) ? supsData : []);
    }).catch(() => {});
  }, []);

  // Debounced Search
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
        const results = (res as any)?.results ?? (Array.isArray(res) ? res : []);
        setSearchResults(results);
        setShowResults(true);
      } catch (err) {
        showToast('error', 'Failed to search items.');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchTerm]);

  // Global Barcode Scanner Hook
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
      const foundItems = (res as any)?.results ?? (Array.isArray(res) ? res : []);
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);

      if (exactMatch) {
        addToCart(exactMatch);
      } else {
        showToast('error', `No item found for barcode: ${barcode}`);
      }
    } catch (err) {
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
        quantity_received: '1',
        unit_cost: item.last_cost_price || '0',
        batch_number: '',
        expiry_date: '',
      }
    ]);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const handleCartChange = (id: number, field: keyof CartItem, value: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalCost = cart.reduce((sum, item) => sum + (Number(item.quantity_received) * Number(item.unit_cost)), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (!form.location) {
      setPageError("Please select a location to stock in.");
      return;
    }
    if (cart.length === 0) {
      setPageError("The item list is empty. Please add items to stock in.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        source: form.source,
        location: Number(form.location),
        supplier: form.supplier ? Number(form.supplier) : null,
        date_received: form.date_received,
        notes: form.notes,
        items: cart.map(c => ({
          item: c.id,
          quantity_received: c.quantity_received,
          unit_cost: c.unit_cost,
          batch_number: c.batch_number || null,
          expiry_date: c.expiry_date || null,
        }))
      };

      await stockInAPI.create(payload);
      showToast('success', 'Stock In batch saved successfully!');
      router.push('/dashboard/staff/inventory/stock-in');
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
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.push('/dashboard/staff/inventory/stock-in')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left Column: Details & Cart */}
        <div className="lg:col-span-2 space-y-5">

          {/* Batch Details Card */}
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

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Source <span className="text-red-400 normal-case">*</span></label>
                <select value={form.source} onChange={e => setForm({...form, source: e.target.value as StockInSource})} className={inputCls}>
                  <option value="purchase">Purchase</option>
                  <option value="return">Return</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="donation">Donation</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Location <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select required value={form.location} onChange={e => setForm({...form, location: e.target.value})} className={`${inputCls} appearance-none pr-9`}>
                    <option value="" disabled>Select Location...</option>
                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>)}
                  </select>
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Supplier (Optional)</label>
                <div className="relative">
                  <select value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} className={`${inputCls} appearance-none pr-9`}>
                    <option value="">None</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                  <Building className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Date Received</label>
                <div className="relative">
                  <input type="date" value={form.date_received} onChange={e => setForm({...form, date_received: e.target.value})} className={`${inputCls} pr-9`} />
                  <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Optional notes..." className={inputCls} />
              </div>
            </div>
          </div>

          {/* Item Search & Cart Card */}
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
              <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  placeholder="Search inventory..."
                  className={`${inputCls} pl-10 pr-10`}
                />
                {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}

                {/* Search Results Dropdown */}
                {showResults && !isSearching && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map(item => (
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
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-400">No items found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-center">
                  <Package className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">The item list is empty.</p>
                  <p className="text-xs text-slate-400 mt-1">Use the search box or scanner to add items.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left font-semibold text-slate-500 pb-2 pr-2">Item</th>
                        <th className="text-left font-semibold text-slate-500 pb-2 px-2 w-24">Qty</th>
                        <th className="text-left font-semibold text-slate-500 pb-2 px-2 w-32">Unit Cost (₦)</th>
                        <th className="text-left font-semibold text-slate-500 pb-2 px-2 w-32">Batch No.</th>
                        <th className="text-left font-semibold text-slate-500 pb-2 px-2 w-36">Expiry Date</th>
                        <th className="pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cart.map(item => (
                        <tr key={item.id}>
                          <td className="py-2 pr-2">
                            <p className="font-medium text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.unit}</p>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantity_received}
                              onChange={e => handleCartChange(item.id, 'quantity_received', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_cost}
                              onChange={e => handleCartChange(item.id, 'unit_cost', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.batch_number}
                              onChange={e => handleCartChange(item.id, 'batch_number', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="date"
                              value={item.expiry_date}
                              onChange={e => handleCartChange(item.id, 'expiry_date', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Summary</h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {pageError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{pageError}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Items in List</span>
                <span className="text-lg font-bold text-slate-800">{cart.length}</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-sm text-slate-500">Total Cost</span>
                <span className="text-xl font-extrabold text-blue-600">₦{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-2 pt-4">
                <button
                  type="submit"
                  disabled={isSaving || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Stock In</>}
                </button>
                <Link href="/dashboard/staff/inventory/stock-in"
                  className="w-full block text-center px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}