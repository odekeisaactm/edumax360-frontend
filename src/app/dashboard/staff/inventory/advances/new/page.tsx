'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI } from '@/lib/api';
import api from '@/lib/api';
import { InventoryItemList } from '@/lib/types';
import {
  ArrowLeft, Wallet, Save, X, Check, AlertCircle,
  Loader2, Search, ScanLine, Trash2, User, FileText,
  Plus, PackageOpen
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

interface StaffResult { id: number; full_name: string; staff_id?: string; }

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
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
            'bg-indigo-50 border-indigo-200 text-indigo-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : t.type === 'error'
            ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
            : <ScanLine className="h-4 w-4 flex-shrink-0 mt-0.5 text-indigo-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const cellInputCls = 'w-full px-2 py-2 sm:py-1.5 border rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-sm sm:text-xs bg-white';

interface CartItem {
  cart_id: string; // Unique ID for React map rendering
  item_id: number | null; // Nullable for custom/random items
  item_description: string;
  quantity: string;
  estimated_unit_cost: string;
  is_official: boolean; // Just to help with UI styling
}

export default function NewPurchaseAdvancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState({ purpose: '' });

  // Staff Search State
  const [selectedStaff, setSelectedStaff] = useState<StaffResult | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);
  const [showStaffResults, setShowStaffResults] = useState(false);
  const [isSearchingStaff, setIsSearchingStaff] = useState(false);

  // Item Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItemList[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorypurchaseadvancemodel');

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Staff Search Debounce Logic
  useEffect(() => {
    if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current);
    if (staffSearch.trim().length < 2) {
      setStaffResults([]);
      setShowStaffResults(false);
      return;
    }
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
      } catch {
        showToast('error', 'Failed to search staff.');
      } finally {
        setIsSearchingStaff(false);
      }
    }, 300);
    return () => { if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffSearch]);

  // Debounced Item Search
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Global Barcode Scanner
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

      if (exactMatch) addOfficialItemToCart(exactMatch);
      else showToast('error', `No item found for barcode: ${barcode}`);
    } catch {
      showToast('error', 'Error looking up barcode.');
    }
  };

  const addOfficialItemToCart = (item: InventoryItemList) => {
    if (cart.some(c => c.item_id === item.id)) {
      showToast('error', `'${item.name}' is already in the advance list.`);
      return;
    }

    setCart(prev => [...prev, {
      cart_id: Math.random().toString(36).substr(2, 9),
      item_id: item.id,
      item_description: item.name,
      quantity: '',
      estimated_unit_cost: item.last_cost_price ? String(item.last_cost_price) : '',
      is_official: true
    }]);

    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const addCustomItemToCart = () => {
    setCart(prev => [...prev, {
      cart_id: Math.random().toString(36).substr(2, 9),
      item_id: null,
      item_description: '',
      quantity: '1',
      estimated_unit_cost: '',
      is_official: false
    }]);
  };

  const handleCartChange = (cart_id: string, field: 'quantity' | 'estimated_unit_cost' | 'item_description', value: string) => {
    setCart(prev => prev.map(item => {
      if (item.cart_id !== cart_id) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveItem = (cart_id: string) => {
    setCart(prev => prev.filter(item => item.cart_id !== cart_id));
  };

  const hasInvalidInputs = cart.some(
    c => !c.quantity || Number(c.quantity) <= 0 || !c.estimated_unit_cost || Number(c.estimated_unit_cost) < 0 || !c.item_description.trim()
  );

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const c = Number(item.estimated_unit_cost) || 0;
      return sum + (q * c);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (!selectedStaff) { setPageError('Please select a Staff Member.'); return; }
    if (!form.purpose.trim()) { setPageError('Please provide a purpose for this advance.'); return; }
    if (cart.length === 0) { setPageError('Add at least one item (official or custom) to the request.'); return; }
    if (hasInvalidInputs) { setPageError('Fix invalid quantities, costs, or empty descriptions before saving.'); return; }

    setIsSaving(true);
    try {
      const payload = {
        staff: selectedStaff.id,
        purpose: form.purpose,
        items: cart.map(c => ({
          item: c.item_id || null, // null for custom items
          item_description: c.item_description.trim(),
          quantity: Number(c.quantity),
          estimated_unit_cost: Number(c.estimated_unit_cost)
        })),
      };

      const res = await api.post('/api/inventory/advances/', payload);
      const created = res.data?.data || res.data;

      showToast('success', 'Purchase Advance request created successfully!');
      router.push(`/dashboard/staff/inventory/advances/${created.id}`);
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
          onClick={() => router.push('/dashboard/staff/inventory/advances')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            New Purchase Advance
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Request funds for a market run</p>
        </div>
      </div>

      <form id="advance-form" onSubmit={handleSubmit} className="space-y-5">

        {/* ── Request Details ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 rounded-t-2xl">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Request Details</h3>
              <p className="text-xs text-slate-400">Specify the staff member and purpose of the funds</p>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5">
              <label className={labelCls}>Staff Member <span className="text-red-400 normal-case">*</span></label>
              {selectedStaff ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl max-w-md">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-900 truncate">{selectedStaff.full_name}</p>
                    {selectedStaff.staff_id && <p className="text-xs text-indigo-600">{selectedStaff.staff_id}</p>}
                  </div>
                  <button type="button" onClick={() => { setSelectedStaff(null); setStaffSearch(''); }}
                    className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative max-w-md">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  <input type="text" value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    onFocus={() => staffSearch.length >= 2 && setShowStaffResults(true)}
                    onBlur={() => setTimeout(() => setShowStaffResults(false), 200)}
                    placeholder="Type staff name to search..."
                    className={`${inputCls} pl-10 pr-10`} />
                  {isSearchingStaff && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />
                  )}
                  {showStaffResults && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl z-[60] max-h-56 overflow-y-auto">
                      {isSearchingStaff ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500 mx-auto" />
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

            <div>
              <label className={labelCls}>Purpose <span className="text-red-400 normal-case">*</span></label>
              <textarea
                required
                rows={3}
                value={form.purpose}
                onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="E.g., Boarding house weekly food supply and sanitation items..."
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* ── Item Search & Hybrid Cart ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Request Items & Estimates</h3>
                <p className="text-xs text-slate-400">Search official items or add custom expenses</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addCustomItemToCart}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Custom Item
            </button>
          </div>

          <div className="p-6">
            {/* Search */}
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder="Search official inventory items..."
                className={`${inputCls} pl-10 pr-10`}
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />
              )}
              {showResults && (
                <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl z-[60] max-h-72 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin text-indigo-500 mx-auto" /></div>
                  ) : searchResults.length > 0 ? searchResults.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onMouseDown={() => addOfficialItemToCart(item)}
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

            {/* Cart */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <PackageOpen className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No items added to the request yet.</p>
                <p className="text-xs text-slate-400 mt-1">Search for an official item or click "Add Custom Item".</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Desktop Cart Header */}
                <div
                  className="hidden sm:grid gap-4 px-3 pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1.5fr 100px 140px 100px 2rem' }}
                >
                  <span>Item Description</span>
                  <span>Est. Qty</span>
                  <span>Est. Unit Cost (₦)</span>
                  <span className="text-right">Line Total</span>
                  <span />
                </div>

                {cart.map(item => {
                  const qty = Number(item.quantity) || 0;
                  const cost = Number(item.estimated_unit_cost) || 0;
                  const lineTotal = qty * cost;
                  const isInvalidDesc = !item.item_description.trim();
                  const isInvalidQty = !item.quantity || qty <= 0;
                  const isInvalidCost = !item.estimated_unit_cost || cost < 0;

                  return (
                    <div
                      key={item.cart_id}
                      className={`relative flex flex-col sm:grid sm:items-center gap-3 sm:gap-4 rounded-xl border px-4 py-4 sm:py-3 transition-colors
                        ${item.is_official ? 'border-slate-100 bg-slate-50/40' : 'border-indigo-100 bg-indigo-50/30'}`}
                      style={{ gridTemplateColumns: '1.5fr 100px 140px 100px 2rem' }}
                    >
                      {/* Description Input */}
                      <div className="flex flex-col gap-1 pr-8 sm:pr-0">
                        {!item.is_official && <span className="sm:hidden text-[10px] font-semibold text-indigo-500 uppercase">Custom Item Description</span>}
                        <input
                          type="text"
                          placeholder="E.g., Transport Fare"
                          value={item.item_description}
                          onChange={e => handleCartChange(item.cart_id, 'item_description', e.target.value)}
                          className={`${cellInputCls} w-full font-medium ${isInvalidDesc ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
                          readOnly={item.is_official}
                        />
                        {item.is_official && (
                          <span className="text-[10px] text-slate-400 font-medium ml-1 flex items-center gap-1">
                            <Check className="h-3 w-3 text-emerald-500" /> Linked to Official Inventory
                          </span>
                        )}
                      </div>

                      {/* Quantity input */}
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Est. Qty:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleCartChange(item.cart_id, 'quantity', e.target.value)}
                          className={`${cellInputCls} flex-1 ${isInvalidQty ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
                        />
                      </div>

                      {/* Cost input */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Est. Cost:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Cost (₦)"
                          value={item.estimated_unit_cost}
                          onChange={e => handleCartChange(item.cart_id, 'estimated_unit_cost', e.target.value)}
                          className={`${cellInputCls} flex-1 ${isInvalidCost ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
                        />
                      </div>

                      {/* Line Total */}
                      <div className="flex items-center gap-2 sm:justify-end">
                         <span className="sm:hidden text-[10px] font-semibold text-slate-500 uppercase flex-shrink-0 w-16">Est. Total:</span>
                         <span className="text-sm font-bold text-slate-700">
                           ₦{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.cart_id)}
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
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Lines</p>
              <p className="text-lg font-bold text-slate-800">{cart.length}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Total Requested</p>
              <p className="text-lg font-black text-indigo-600">
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
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Req. Total</p>
                <p className="text-sm font-black text-indigo-600">
                  ₦{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
             </div>

            <Link
              href="/dashboard/staff/inventory/advances"
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-center transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              form="advance-form"
              disabled={isSaving || cart.length === 0 || hasInvalidInputs}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-purple-800 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                : <><Save className="h-4 w-4" /> Submit Request</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}