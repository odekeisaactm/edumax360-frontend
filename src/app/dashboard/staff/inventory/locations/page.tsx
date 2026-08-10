// app/dashboard/staff/inventory/locations/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { inventoryLocationAPI } from '@/lib/api';
import { InventoryLocation, InventoryLocationType } from '@/lib/types';
import {
  MapPin, Plus, Edit3, Trash2, Search,
  X, Check, AlertCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, RefreshCw, Store, ShoppingBag, Building,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);         // <-- ADDED: Handles your custom APIResponse.error()
    if (d.detail) return String(d.detail);       // Handles standard DRF 403/404
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);     // Handles generic exceptions
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

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, location, isDeleting, onConfirm, onCancel }: {
  open: boolean; location: InventoryLocation | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !location) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Location</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{location.name}"</span>?
          This cannot be undone.
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

// ─── Form Values ───────────────────────────────────────────────────────────────
interface LocationFormValues {
  name: string;
  code: string;
  location_type: InventoryLocationType;
  is_active: boolean;
}

// ─── Location Form Modal ───────────────────────────────────────────────────────
function LocationModal({ editing, isSaving, onSave, onClose }: {
  editing: InventoryLocation | null;
  isSaving: boolean;
  onSave: (data: LocationFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LocationFormValues>(
    editing
      ? {
          name: editing.name,
          code: editing.code,
          location_type: editing.location_type,
          is_active: editing.is_active,
        }
      : { name: '', code: '', location_type: 'store', is_active: true }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof LocationFormValues>(key: K, value: LocationFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {editing ? 'Edit Location' : 'New Location'}
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
        <form id="location-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Location Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Main Store, Tuck Shop, Boarding House" className={inputCls} />
            </div>

            {/* Code */}
            <div>
              <label className={labelCls}>Location Code <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. STORE, SHOP_A, BOARD" className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Unique short code (auto-uppercased)</p>
            </div>

            {/* Type */}
            <div>
              <label className={labelCls}>Location Type <span className="text-red-400 normal-case">*</span></label>
              <select value={form.location_type} onChange={e => set('location_type', e.target.value as InventoryLocationType)}
                className={inputCls}>
                <option value="store">Store (Tracked)</option>
                <option value="shop">Shop (Tracked)</option>
                <option value="generic">Generic / Station (Untracked)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Stock is only live-tracked for Shops and Stores.</p>
            </div>
          </div>

          {/* Active toggle */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-400">Location is available for use</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
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
          <button type="submit" form="location-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Location' : 'Create Location'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const { hasPermission, user } = useAuth();

  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingLocation, setDeletingLocation] = useState<InventoryLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('inventory.add_inventoryitemmodel');
  const canEdit   = user?.is_superuser || hasPermission('inventory.add_inventoryitemmodel');
  const canDelete = user?.is_superuser || hasPermission('inventory.delete_inventoryitemmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await inventoryLocationAPI.list();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingLocation(null); setShowModal(true); };
  const openEdit = (location: InventoryLocation) => { setEditingLocation(location); setShowModal(true); };

  const handleSave = async (form: LocationFormValues) => {
    setIsSaving(true);
    try {
      if (editingLocation) {
        const updated = await inventoryLocationAPI.update(editingLocation.id, form);
        setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await inventoryLocationAPI.create(form);
        setLocations(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingLocation) return;
    setIsDeleting(true);
    try {
      await inventoryLocationAPI.delete(deletingLocation.id);
      setLocations(prev => prev.filter(l => l.id !== deletingLocation.id));
      showToast('success', `"${deletingLocation.name}" deleted`);
      setDeletingLocation(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingLocation(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = locations.filter(l => {
    const name = l.name || '';
    const code = l.code || '';
    const matchSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchActive = !showActiveOnly || l.is_active;
    return matchSearch && matchActive;
  });

  const totalActive = locations.filter(l => l.is_active).length;
  const totalShops = locations.filter(l => l.location_type === 'shop').length;
  const totalStores = locations.filter(l => l.location_type === 'store').length;

  const getTypeMeta = (type: InventoryLocationType) => {
    switch (type) {
      case 'shop': return { label: 'Shop', icon: ShoppingBag, bg: 'bg-violet-100', text: 'text-violet-700' };
      case 'store': return { label: 'Store', icon: Store, bg: 'bg-amber-100', text: 'text-amber-700' };
      default: return { label: 'Generic', icon: Building, bg: 'bg-slate-100', text: 'text-slate-600' };
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingLocation} location={deletingLocation} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingLocation(null)}
      />

      {showModal && (
        <LocationModal
          editing={editingLocation}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Inventory Locations
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage physical stock locations like Main Store, Tuck Shop</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Location
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Locations', value: locations.length, icon: MapPin, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Shops', value: totalShops, icon: ShoppingBag, color: 'from-violet-500 to-purple-600' },
          { label: 'Stores', value: totalStores, icon: Store, color: 'from-amber-500 to-orange-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
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

        {/* Search + filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or code..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading locations...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm ? 'No locations match your search' : 'No locations yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm ? 'Try different keywords.' : 'Add your first inventory location to get started.'}
            </p>
            {!searchTerm && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Location
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location Details</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
              <span className="w-8"></span> {/* Spacer for expand btn */}
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(location => {
                const typeMeta = getTypeMeta(location.location_type);
                return (
                  <div key={location.id}>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                      {/* Name + code */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${location.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                          <MapPin className={`h-4 w-4 ${location.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{location.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{location.code}</p>
                        </div>
                      </div>

                      {/* Type */}
                      <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 px-2 py-1 ${typeMeta.bg} ${typeMeta.text} text-xs font-bold rounded-full whitespace-nowrap`}>
                          <typeMeta.icon className="h-3 w-3" /> {typeMeta.label}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(location)} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingLocation(location)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Expand Toggle */}
                      <button onClick={() => setExpandedId(expandedId === location.id ? null : location.id)} title="Toggle details"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all w-8 h-8 flex items-center justify-center">
                        {expandedId === location.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Expanded row */}
                    {expandedId === location.id && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location ID</span>
                            <p className="mt-1 text-slate-700 font-medium">#{location.id}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                            <p className="mt-1 text-slate-700">{location.is_active ? 'Active' : 'Inactive'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</span>
                            <p className="mt-1 text-slate-700">{new Date(location.updated_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {locations.length} location{locations.length !== 1 ? 's' : ''}
                {showActiveOnly ? ' (active only)' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}