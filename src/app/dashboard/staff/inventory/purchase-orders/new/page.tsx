'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI } from '@/lib/api';
import api from '@/lib/api';
import { InventoryItemList } from '@/lib/types';
import {
  ArrowLeft, ShoppingCart, Save, X, Check, AlertCircle,
  Loader2, Search, ScanLine, Trash2, Building2, CalendarDays,
  Package, FileText, Send
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

// UPDATED: Much smarter error extractor to handle deeply nested DRF validation arrays
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error && typeof d.error === 'string') return d.error;
    if (d.detail && typeof d.detail === 'string') return d.detail;
    if (d.message && typeof d.message === 'string') return d.message;
    if (d.details) {
      if (typeof d.details === 'string') return d.details;
      try {
        // Flatten nested arrays/objects into a readable string
        return JSON.stringify(d.details).replace(/["'{}\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      } catch {
        return 'A validation error occurred.';
      }
    }
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

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const cellInputCls = 'w-full px-2 py-2 sm:py-1.5 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm sm:text-xs bg-white';

interface CartItem extends InventoryItemList {
  quantity: string;
  unit_cost: string;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({ supplier: '', expected_date: '', notes: '' });
  const [suppliers, setSuppliers] = useState<{id: number, name: string}[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItemList[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  // Use a string to track which button is loading
  const [isSaving, setIsSaving] = useState<'draft' | 'submitted' | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.is_superuser ||
    hasPermission('inventory.add_inventorypurchaseordermodel') ||
    hasPermission('inventory.add_inventorypurchaseadvancemodel');

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    api.get('/api/inventory/suppliers/', { params: { status: 'active', page_size: 500 } })
      .then(res => {
        const data = res.data;
        const arr = Array.isArray(data) ? data : (data?.results?.data || data?.results || []);
        setSuppliers(arr);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const urlItemId = searchParams.get('item_id');
    let isMounted = true;

    if (urlItemId) {
      inventoryItemAPI.get(Number(urlItemId))
        .then((itemData: any) => {
          if (isMounted) {
            addToCart(itemData);
            showToast('info', `Added "${itemData.name}" to your order draft.`);
          }
        })
        .catch(() => {
          if (isMounted) showToast('error', 'Could not auto-load the requested item.');
        });
    }
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        const res = await inventoryItemAPI.list({ search: searchTerm });
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
      const res = await inventoryItemAPI.list({ search: barcode });
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
      showToast('error', `'${item.name}' is already in the order list.`);
      return;
    }

    setCart(prev => {
      if (prev.some(c => c.id === item.id)) return prev;
      return [...prev, {
        ...item,
        quantity: '',
        unit_cost: item.last_cost_price ? String(item.last_cost_price) : ''
      }];
    });

    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const handleCartChange = (id: number, field: 'quantity' | 'unit_cost', value: string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const hasInvalidInputs = cart.some(
    c => !c.quantity || Number(c.quantity) <= 0 || !c.unit_cost || Number(c.unit_cost) < 0
  );

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const c = Number(item.unit_cost) || 0;
      return sum + (q * c);
    }, 0);
  };

  // UPDATED: Accepts a status param to save as Draft or Submitted
  const handleSubmit = async (targetStatus: 'draft' | 'submitted') => {
    setPageError(null);

    if (!form.supplier) { setPageError('Please select a Supplier.'); return; }
    if (cart.length === 0) { setPageError('Add at least one item to the order.'); return; }
    if (hasInvalidInputs) { setPageError('Fix invalid quantities or costs before saving.'); return; }

    setIsSaving(targetStatus);
    try {
      const payload = {
        supplier: Number(form.supplier),
        expected_date: form.expected_date || null,
        notes: form.notes,
        status: targetStatus,
        items: cart.map(c => ({
          item: c.id,
          item_description: c.name, // Extra safety net mapped explicitly
          quantity: Number(c.quantity),
          unit_cost: Number(c.unit_cost)
        })),
      };

      const res = await api.post('/api/inventory/purchase-orders/', payload);
      const created = res.data?.data || res.data;

      showToast('success', `Purchase Order ${targetStatus === 'submitted' ? 'submitted' : 'saved as draft'} successfully!`);
      router.push(`/dashboard/staff/inventory/purchase-orders/${created.id}`);
    } catch (err) {
      showToast('error', extractError(err));
      setIsSaving(null);
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
          <p className="text-sm text-slate-400">You don't have permission to manage procurement.</p>
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
          onClick={() => router.push('/dashboard/staff/inventory/purchase-orders')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            New Purchase Order
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Draft a new order for a supplier</p>
        </div>
      </div>

      <form id="po-form" onSubmit={(e) => { e.preventDefault(); /* submission handled by buttons */ }} className="space-y-5">

        {/* ── Order Details ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Order Information</h3>
              <p className="text-xs text-slate-400">Set the supplier and expected delivery timeframe</p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div>
                <label className={labelCls}>Supplier <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select
                    required
                    value={form.supplier}
                    onChange={e => setForm(prev => ({ ...prev, supplier: e.target.value }))}
                    className={`${inputCls} appearance-none pr-9`}
                  >
                    <option value="" disabled>Select supplier...</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Expected Delivery Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.expected_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(prev => ({ ...prev, expected_date: e.target.value }))}
                    className={inputCls}
                  />
                  <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Order Notes / Terms</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="E.g., Please deliver directly to the main store before 10 AM..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── Item Search & Cart ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Add Items to Order</h3>
                <p className="text-xs text-slate-400">Search products to include in this Purchase Order</p>
              </div>
            </div>
          </div>

          <div className="p-6">
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
                placeholder="Search items by name or barcode..."
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
                      className="w-full flex items-center justify-between gap-3 p-3 transition-colors text-left border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {item.barcode || 'No barcode'} • {item.category_name}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400">
                          Curr. Stock: {Number(item.total_quantity).toFixed(0)}
                        </span>
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
              <div className="space-y-2">
                {/* Desktop Cart Header */}
                <div
                  className="hidden sm:grid gap-4 px-3 pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 120px 140px 100px 2rem' }}
                >
                  <span>Item Description</span>
                  <span>Quantity</span>
                  <span>Unit Cost (₦)</span>
                  <span className="text-right">Line Total</span>
                  <span />
                </div>

                {cart.map(item => {
                  const qty = Number(item.quantity) || 0;
                  const cost = Number(item.unit_cost) || 0;
                  const lineTotal = qty * cost;
                  const isInvalidQty = !item.quantity || qty <= 0;
                  const isInvalidCost = !item.unit_cost || cost < 0;

                  return (
                    <div
                      key={item.id}
                      className="relative flex flex-col sm:grid sm:items-center gap-3 sm:gap-4 rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-4 sm:py-3 transition-colors"
                      style={{ gridTemplateColumns: '1fr 120px 140px 100px 2rem' }}
                    >
                      {/* Item info */}
                      <div className="min-w-0 pr-8 sm:pr-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{item.unit} • {item.category_name}</span>
                          <span className="text-blue-500 font-medium">Curr. Stock: {Number(item.total_quantity).toFixed(0)}</span>
                        </p>
                      </div>

                      {/* Quantity input */}
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Qty:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleCartChange(item.id, 'quantity', e.target.value)}
                          className={`${cellInputCls} flex-1 ${isInvalidQty ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
                        />
                      </div>

                      {/* Cost input */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Cost (₦):</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Cost"
                          value={item.unit_cost}
                          onChange={e => handleCartChange(item.id, 'unit_cost', e.target.value)}
                          className={`${cellInputCls} flex-1 ${isInvalidCost ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
                        />
                      </div>

                      {/* Line Total */}
                      <div className="flex items-center gap-2 sm:justify-end">
                         <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Total:</span>
                         <span className="text-sm font-bold text-slate-700">
                           ₦{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="absolute top-4 right-4 sm:static p-1.5 rounded-lg text-red-500 bg-red-50 sm:bg-transparent hover:bg-red-100 sm:hover:bg-red-50 transition-colors flex-shrink-0 sm:mt-0.5"
                      >
                        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Items</p>
              <p className="text-lg font-bold text-slate-800">{cart.length}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Est. Order Value</p>
              <p className="text-lg font-black text-blue-600">
                ₦{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {pageError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 max-w-xs">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600 line-clamp-2">{pageError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="sm:hidden flex-1 text-right mr-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Est. Total</p>
                <p className="text-sm font-black text-blue-600">
                  ₦{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
             </div>

            <Link
              href="/dashboard/staff/inventory/purchase-orders"
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-center transition-colors"
            >
              Cancel
            </Link>

            {/* Save as Draft Button */}
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={!!isSaving || cart.length === 0 || hasInvalidInputs}
              className="px-5 py-2.5 bg-white border border-blue-200 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>

            {/* Submit Order Button */}
            <button
              type="button"
              onClick={() => handleSubmit('submitted')}
              disabled={!!isSaving || cart.length === 0 || hasInvalidInputs}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving === 'submitted' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}