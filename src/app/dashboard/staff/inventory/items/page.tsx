// app/dashboard/staff/inventory/items/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryCategoryAPI, inventoryLocationAPI } from '@/lib/api';
import { InventoryItemList, InventoryItem, InventoryCategory, InventoryLocation } from '@/lib/types';
import {
  Package, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, Eye,
  ChevronLeft, ChevronRight, ScanLine, Tag, Save, DollarSign, Settings, ToggleLeft, MapPin,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
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
    if (d.non_field_errors?.length) return d.non_field_errors[0];
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
            'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> :
           t.type === 'error' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" /> :
           <ScanLine className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, item, isDeleting, onConfirm, onCancel }: {
  open: boolean; item: InventoryItemList | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Item</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{item.name}"</span>?
          This will affect all historical stock and sales records.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UI Constants ──────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

interface ItemFormValues {
  name: string;
  category: number | '';
  barcode: string;
  unit: 'piece' | 'pack' | 'box' | 'kg' | 'carton';
  current_selling_price: string;
  reorder_level: string;
  is_active: boolean;
}

interface OpeningBalance {
  location_id: number | '';
  quantity: string;
}

// ─── Item Form Modal (Create & Edit) ───────────────────────────────────────────
function ItemModal({ editing, isSaving, onSave, onClose }: {
  editing: InventoryItem | null;
  isSaving: boolean;
  onSave: (form: ItemFormValues, initialStocks: OpeningBalance[]) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemFormValues>(
    editing
      ? {
          name: editing.name,
          category: typeof editing.category === 'object' ? editing.category.id : editing.category,
          barcode: editing.barcode || '',
          unit: editing.unit,
          current_selling_price: editing.current_selling_price,
          reorder_level: editing.reorder_level,
          is_active: editing.is_active,
        }
      : { name: '', category: '', barcode: '', unit: 'piece', current_selling_price: '0', reorder_level: '0', is_active: true }
  );

  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [trackedLocations, setTrackedLocations] = useState<InventoryLocation[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      inventoryCategoryAPI.list(),
      inventoryLocationAPI.list()
    ]).then(([catsData, locsData]) => {
      setCategories(Array.isArray(catsData) ? catsData : []);
      const tracked = (Array.isArray(locsData) ? locsData : []).filter(
        (l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'
      );
      setTrackedLocations(tracked);
    }).catch(() => {});
  }, []);

  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleAddBalance = () => {
    if (trackedLocations.length === 0) return;
    const lastRow = openingBalances[openingBalances.length - 1];
    if (lastRow && !lastRow.location_id) return;
    setOpeningBalances(prev => [...prev, { location_id: '', quantity: '0' }]);
  };

  const handleBalanceChange = (index: number, field: keyof OpeningBalance, value: string) => {
    setOpeningBalances(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveBalance = (index: number) => {
    setOpeningBalances(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editing) {
      const locIds = openingBalances.map(ob => ob.location_id).filter(id => id !== '');
      const hasDuplicates = new Set(locIds).size !== locIds.length;
      if (hasDuplicates) {
        setFormError("Cannot select the same location more than once for opening balances.");
        return;
      }
    }

    try {
      await onSave(form, openingBalances);
    } catch (err) {
      setFormError(extractError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5" />
            {editing ? 'Edit Item' : 'New Item'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="item-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Section 1: Core Details */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Core Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Item Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Notebook, Pen, Chalk" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Category <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <select required value={form.category} onChange={e => set('category', Number(e.target.value))}
                    className={`${inputCls} appearance-none pr-9`}>
                    <option value="" disabled>Select a category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Tag className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Unit of Measure <span className="text-red-400 normal-case">*</span></label>
                <select value={form.unit} onChange={e => set('unit', e.target.value as any)}
                  className={inputCls}>
                  <option value="piece">Piece</option>
                  <option value="pack">Pack</option>
                  <option value="box">Box</option>
                  <option value="kg">Kilogram</option>
                  <option value="carton">Carton</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Barcode (SKU)</label>
                <div className="relative">
                  <input type="text" value={form.barcode} onChange={e => set('barcode', e.target.value)}
                    placeholder="Scan or type barcode (optional)" className={`${inputCls} pr-9`} />
                  <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Initial Stock */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Pricing {editing ? '& Settings' : '& Initial Stock'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className={labelCls}>Selling Price (₦) <span className="text-red-400 normal-case">*</span></label>
                <div className="relative">
                  <input required type="number" step="0.01" min="0" value={form.current_selling_price} onChange={e => set('current_selling_price', e.target.value)}
                    className={`${inputCls} pl-8`} />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Re-order Level <span className="text-red-400 normal-case">*</span></label>
                <input required type="number" step="0.01" min="0" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Alert threshold for low stock</p>
              </div>
            </div>

            {/* Dynamic Opening Balances (Only for Create) */}
            {!editing && (
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Opening Balances</p>
                    <p className="text-xs text-slate-400 mt-0.5">Distribute initial stock across tracked locations</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBalance}
                    disabled={trackedLocations.length === 0 || openingBalances.length >= trackedLocations.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Balance
                  </button>
                </div>

                {openingBalances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                    <MapPin className="h-5 w-5 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400">No opening balances added. You can add stock later via Stock In.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openingBalances.map((balance, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <select
                            value={balance.location_id}
                            onChange={e => handleBalanceChange(index, 'location_id', e.target.value)}
                            className={`${inputCls} appearance-none pr-9`}
                          >
                            <option value="" disabled>Select Location...</option>
                            {trackedLocations.map(loc => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({loc.location_type === 'shop' ? 'Shop' : 'Store'})
                              </option>
                            ))}
                          </select>
                          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Qty"
                            value={balance.quantity}
                            onChange={e => handleBalanceChange(index, 'quantity', e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBalance(index)}
                          className="p-2.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Settings */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Settings</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <ToggleLeft className={`h-8 w-8 ${form.is_active ? 'text-blue-500' : 'text-slate-300'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Is Active?</p>
                  <p className="text-xs text-slate-400">Inactive items cannot be sold or stocked in</p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="item-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> {editing ? 'Update Item' : 'Create Item'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ItemsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [items, setItems] = useState<InventoryItemList[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingItem, setDeletingItem] = useState<InventoryItemList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  const canCreate = user?.is_superuser || hasPermission('inventory.add_itemmodel');
  const canEdit   = user?.is_superuser || hasPermission('inventory.add_itemmodel');
  const canDelete = user?.is_superuser || hasPermission('inventory.delete_itemmodel');

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchItems = useCallback(async (search: string, category: number | '', activeOnly: boolean, pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (category) params.category = category;
      if (activeOnly) params.is_active = 'true';

      const data = await inventoryItemAPI.list(params);

      let results: any[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results?.data && Array.isArray(data.results.data)) {
        results = data.results.data;
        totalCount = data.count || results.length;
      } else if (data?.results && Array.isArray(data.results)) {
        results = data.results;
        totalCount = data.count || results.length;
      } else if (data?.data && Array.isArray(data.data)) {
        results = data.data;
        totalCount = results.length;
      }

      setItems(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    inventoryCategoryAPI.list()
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchItems(pendingSearch, selectedCategory, showActiveOnly, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  useEffect(() => { fetchItems('', '', false, 1); }, []);

  // ─── Global Barcode Scanner Hook ──
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
  }, [items]);

  const handleBarcodeScan = async (barcode: string) => {
    showToast('info', `Scanned: ${barcode}. Searching...`);
    try {
      const res = await inventoryItemAPI.list({ search: barcode, page_size: 5 });
      const foundItems = (res as any)?.results ?? (Array.isArray(res) ? res : []);
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);

      if (exactMatch) {
        router.push(`/dashboard/staff/inventory/items/${exactMatch.id}`);
      } else {
        showToast('error', `No item found for barcode: ${barcode}`);
      }
    } catch (err) {
      showToast('error', 'Error looking up barcode.');
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setShowFormModal(true);
  };

  const openEdit = async (id: number) => {
    try {
      const itemData = await inventoryItemAPI.get(id);
      setEditingItem(itemData);
      setShowFormModal(true);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleSave = async (form: ItemFormValues, initialStocks: OpeningBalance[]) => {
      setIsSaving(true);
      try {
        if (editingItem) {
          // Transform category to match API expectations
          const updateData = {
            ...form,
            category: form.category === '' ? undefined : Number(form.category),
          };
          await inventoryItemAPI.update(editingItem.id, updateData);
          showToast('success', `"${editingItem.name}" updated successfully`);
          // Refresh the list to get the updated item with all fields
          fetchItems(pendingSearch, selectedCategory, showActiveOnly, page);
        } else {
          const payload = {
            ...form,
            category: Number(form.category),
            current_selling_price: form.current_selling_price || '0',
            reorder_level: form.reorder_level || '0',
            initial_stocks: initialStocks.filter(ob => ob.location_id && Number(ob.quantity) > 0)
          };
          const created = await inventoryItemAPI.create(payload);
          showToast('success', `"${created.name}" created successfully`);
          fetchItems(pendingSearch, selectedCategory, showActiveOnly, 1);
        }
        setShowFormModal(false);
      } catch (err) {
        throw err;
      } finally { setIsSaving(false); }
    };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await inventoryItemAPI.delete(deletingItem.id);
      setItems(prev => prev.filter(i => i.id !== deletingItem.id));
      showToast('success', `"${deletingItem.name}" deleted`);
      setDeletingItem(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingItem(null);
    } finally { setIsDeleting(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const lowStockCount = items.filter(i => i.is_low_stock).length;
  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingItem} item={deletingItem} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingItem(null)}
      />

      {showFormModal && (
        <ItemModal
          editing={editingItem}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowFormModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            Inventory Items
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage products, stock levels, and pricing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* ── Barcode Scan Tip ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
        <ScanLine className="h-5 w-5 text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 font-medium">
          <span className="font-bold">Tip:</span> Click anywhere outside an input field and scan an item's barcode to instantly look it up.
        </p>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', value: total, color: 'from-blue-500 to-blue-600' },
          { label: 'Low Stock', value: lowStockCount, color: 'from-orange-400 to-amber-500' },
          { label: 'Active (Page)', value: activeCount, color: 'from-emerald-500 to-teal-600' },
          { label: 'Categories', value: categories.length, color: 'from-violet-500 to-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Package className="h-4 w-4 text-white" />
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
        <div className="px-5 py-4 border-b border-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by name or barcode..."
                value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" role="switch" aria-checked={showActiveOnly}
                  onClick={() => setShowActiveOnly(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-600">Active only</span>
              </label>
              <button onClick={() => fetchItems(pendingSearch, selectedCategory, showActiveOnly, page)} title="Refresh"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading items...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchItems(pendingSearch, selectedCategory, showActiveOnly, 1)}
              className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No items found</h3>
            <p className="text-sm text-slate-400 mb-5">
              {pendingSearch || selectedCategory ? 'Try adjusting your search or filters.' : 'Add your first inventory item to get started.'}
            </p>
            {!pendingSearch && !selectedCategory && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 120px 100px 120px 100px 108px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Details</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {items.map(item => (
                <div key={item.id}
                  className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1fr 120px 100px 120px 100px 108px' }}>

                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <Package className={`h-4 w-4 ${item.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                    {item.barcode && <p className="text-[11px] font-mono text-slate-400 truncate">{item.barcode}</p>}
                  </div>

                  {/* Category */}
                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
                    <Tag className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="truncate text-xs">{item.category_name || 'N/A'}</span>
                  </div>

                  {/* Price */}
                  <div className="hidden sm:block text-sm font-medium text-slate-700">
                    ₦{Number(item.current_selling_price).toLocaleString()}
                  </div>

                  {/* Stock */}
                  <div className="hidden sm:flex flex-col text-xs">
                    <span className="font-medium text-slate-700">
                      Total: {Number(item.total_quantity).toFixed(2)} {item.unit}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    {item.is_low_stock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-orange-50 text-orange-700 border-orange-100">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-orange-500" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500" />
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => router.push(`/dashboard/staff/inventory/items/${item.id}`)}
                      title="View" className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(item.id)}
                        title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingItem(item)}
                        title="Delete" className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> item{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchItems(pendingSearch, selectedCategory, showActiveOnly, page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchItems(pendingSearch, selectedCategory, showActiveOnly, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchItems(pendingSearch, selectedCategory, showActiveOnly, page + 1)} disabled={page === totalPages}
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