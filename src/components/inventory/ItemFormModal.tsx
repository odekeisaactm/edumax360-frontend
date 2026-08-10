// components/inventory/ItemFormModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { inventoryCategoryAPI, inventoryLocationAPI } from '@/lib/api';
import { InventoryItem, InventoryCategory, InventoryLocation } from '@/lib/types';
import {
  Package, X, AlertCircle, Trash2, Plus, MapPin, Save, Loader2, Tag, ScanLine, ToggleLeft,
} from 'lucide-react';

// ─── Shared types (also used by callers) ───────────────────────────────────────
export interface ItemFormValues {
  name: string;
  category: number | '';
  barcode: string;
  unit: 'piece' | 'pack' | 'box' | 'kg' | 'carton';
  current_selling_price: string;
  reorder_level: string;
  is_active: boolean;
}

export interface OpeningBalance {
  location_id: number | '';
  quantity: string;
}

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

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Item Form Modal (Create & Edit) ───────────────────────────────────────────
export default function ItemFormModal({ editing, isSaving, onSave, onClose }: {
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
      // Generic/Station locations aren't stock-tracked — only Store and Shop take opening balances.
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
        setFormError('Cannot select the same location more than once for opening balances.');
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-4 sm:h-5 w-4 sm:w-5" />
            {editing ? 'Edit Item' : 'New Item'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="item-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">

          {/* Section 1: Core Details */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Core Details</h3>
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
            <h3 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Pricing {editing ? '& Settings' : '& Initial Stock'}</h3>
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
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Opening Balances</p>
                    <p className="text-xs text-slate-400 mt-0.5">Distribute initial stock across tracked locations</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBalance}
                    disabled={trackedLocations.length === 0 || openingBalances.length >= trackedLocations.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
                      <div key={index} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-1 relative min-w-0">
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
                        <div className="w-24 sm:w-32 flex-shrink-0">
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
            <h3 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Settings</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <ToggleLeft className={`h-7 sm:h-8 w-7 sm:w-8 flex-shrink-0 ${form.is_active ? 'text-indigo-500' : 'text-slate-300'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Is Active?</p>
                  <p className="text-xs text-slate-400">Inactive items cannot be sold or stocked in</p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 ${form.is_active ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="item-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> {editing ? 'Update Item' : 'Create Item'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}