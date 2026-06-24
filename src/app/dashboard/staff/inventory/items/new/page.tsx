// app/dashboard/staff/inventory/items/new/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, inventoryCategoryAPI, inventoryLocationAPI } from '@/lib/api';
import { InventoryCategory, InventoryLocation } from '@/lib/types';
import {
  Package, Save, X, Check, AlertCircle, Loader2, ArrowLeft,
  Tag, ScanLine, DollarSign, Settings, ToggleLeft, Plus, Trash2, MapPin,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

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

// ─── UI Constants ──────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Form Card Component ───────────────────────────────────────────────────────
function FormCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Form Values ───────────────────────────────────────────────────────────────
interface ItemFormValues {
  name: string;
  category: number | '';
  barcode: string;
  unit: 'piece' | 'pack' | 'box' | 'kg' | 'carton';
  current_selling_price: string;
  reorder_level: string;
  is_active: boolean;
}

const EMPTY_FORM: ItemFormValues = {
  name: '', category: '', barcode: '', unit: 'piece',
  current_selling_price: '0', reorder_level: '0', is_active: true
};

interface OpeningBalance {
  location_id: number | '';
  quantity: string;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NewItemPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [form, setForm] = useState<ItemFormValues>(EMPTY_FORM);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [trackedLocations, setTrackedLocations] = useState<InventoryLocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('inventory.add_itemmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    if (!canCreate) {
      showToast('error', 'You do not have permission to create items.');
      router.push('/dashboard/staff/inventory/items');
      return;
    }

    Promise.all([
      inventoryCategoryAPI.list(),
      inventoryLocationAPI.list()
    ]).then(([catsData, locsData]) => {
      setCategories(Array.isArray(catsData) ? catsData : []);
      // Filter to only tracked locations (store/shop) for opening balances
      const tracked = (Array.isArray(locsData) ? locsData : []).filter(
        (l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'
      );
      setTrackedLocations(tracked);
    }).catch(() => {});
  }, [canCreate, router]);

  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleAddBalance = () => {
    // Prevent adding if there are no more tracked locations to choose
    if (trackedLocations.length === 0) return;

    // Prevent adding if the last row is empty
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

    // Validation: Check for duplicate locations
    const locIds = openingBalances.map(ob => ob.location_id).filter(id => id !== '');
    const hasDuplicates = new Set(locIds).size !== locIds.length;
    if (hasDuplicates) {
      setFormError("Cannot select the same location more than once for opening balances.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...form,
        category: Number(form.category),
        current_selling_price: form.current_selling_price || '0',
        reorder_level: form.reorder_level || '0',
        initial_stocks: openingBalances.filter(ob => ob.location_id && Number(ob.quantity) > 0)
      };

      const created = await inventoryItemAPI.create(payload);
      const createdId = created?.id || (created as any)?.data?.id;

      if (createdId) {
        showToast('success', 'Item created successfully!');
        router.push(`/dashboard/staff/inventory/items/${createdId}`);
      } else {
        showToast('success', 'Item created successfully!');
        router.push('/dashboard/staff/inventory/items');
      }
    } catch (err) {
      setFormError(extractError(err));
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.push('/dashboard/staff/inventory/items')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            Add New Item
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Register a new product or item in the inventory</p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {formError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium flex-1">{formError}</p>
          <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Section 1: Core Details */}
        <FormCard
          icon={<Package className="h-5 w-5 text-white" />}
          title="Core Details"
          subtitle="Basic information about the item"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
        </FormCard>

        {/* Section 2: Pricing & Initial Stock */}
        <FormCard
          icon={<DollarSign className="h-5 w-5 text-white" />}
          title="Pricing & Initial Stock"
          subtitle="Set selling price and opening balances"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
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

          {/* Dynamic Opening Balances */}
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
                {openingBalances.map((balance, index) => {
                  const selectedLoc = trackedLocations.find(l => l.id === balance.location_id);
                  const typeMeta = selectedLoc ? (selectedLoc.location_type === 'shop' ? 'Shop' : 'Store') : '';

                  return (
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
                  );
                })}
              </div>
            )}
          </div>
        </FormCard>

        {/* Section 3: Settings */}
        <FormCard
          icon={<Settings className="h-5 w-5 text-white" />}
          title="Settings"
          subtitle="Item availability status"
        >
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
        </FormCard>

        {/* ── Sticky Footer Actions ── */}
        <div className="sticky bottom-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-4 flex justify-end gap-3">
          <Link href="/dashboard/staff/inventory/items"
            className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={isSaving}
            className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> Save Item</>}
          </button>
        </div>
      </form>
    </div>
  );
}