'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api, { shopAccessAPI, inventoryLocationAPI } from '@/lib/api';
import { StaffShopAccess, InventoryLocation } from '@/lib/types';
import {
  Store, Plus, Edit3, Trash2, Search,
  X, Check, AlertCircle, AlertTriangle, Loader2,
  RefreshCw, UserCog, ShieldOff, ShoppingBag, User
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

function staffDisplayName(s: any): string {
  return s?.full_name || `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || `Staff #${s?.id}`;
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

// ─── Confirm Remove Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, access, isDeleting, onConfirm, onCancel }: {
  open: boolean; access: StaffShopAccess | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !access) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Remove Shop Access</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Remove <span className="font-semibold text-slate-700">"{access.staff_name}"</span>'s access to{' '}
          <span className="font-semibold text-slate-700">"{access.shop_name}"</span>?
          They will not be able to sell from any shop until reassigned.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Removing...</> : <><Trash2 className="h-4 w-4" /> Remove</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Values ───────────────────────────────────────────────────────────────
interface ShopAccessFormValues {
  staff: number | null;
  shop: number | null;
}

// ─── Assign Modal (Dynamic Search) ─────────────────────────────────────────────
function ShopAccessModal({ editing, assignedStaffIds, shopOptions, isSaving, onSave, onClose }: {
  editing: StaffShopAccess | null;
  assignedStaffIds: Set<number>;
  shopOptions: InventoryLocation[];
  isSaving: boolean;
  onSave: (data: ShopAccessFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ShopAccessFormValues>(
    editing ? { staff: editing.staff, shop: editing.shop } : { staff: null, shop: null }
  );

  // Dynamic Staff Search State
  const [selectedStaff, setSelectedStaff] = useState<any | null>(
    editing ? { id: editing.staff, full_name: editing.staff_name } : null
  );
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<any[]>([]);
  const [showStaffResults, setShowStaffResults] = useState(false);
  const [isSearchingStaff, setIsSearchingStaff] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const staffSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof ShopAccessFormValues>(key: K, value: ShopAccessFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Debounced Staff Search
  useEffect(() => {
    if (editing) return; // Prevent searching if editing
    if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current);
    if (staffSearch.trim().length < 2) {
      setStaffResults([]);
      setShowStaffResults(false);
      return;
    }

    setIsSearchingStaff(true);
    staffSearchDebounce.current = setTimeout(async () => {
      try {
        const r = await api.get('/api/human-resource/staff/', { params: { search: staffSearch, page_size: 15 } });
        const data = r?.data;
        let results: any[] = [];
        if (data?.success && Array.isArray(data.data)) results = data.data;
        else if (data?.results?.data && Array.isArray(data.results.data)) results = data.results.data;
        else if (data?.results && Array.isArray(data.results)) results = data.results;

        // Filter out staff who are already assigned to a shop
        const availableStaff = results.filter(s => !assignedStaffIds.has(s.id));

        setStaffResults(availableStaff.map((s: any) => ({
          id: s.id,
          full_name: staffDisplayName(s),
          staff_id: s.staff_id,
        })));
        setShowStaffResults(true);
      } catch {
        setFormError('Failed to search staff.');
      } finally {
        setIsSearchingStaff(false);
      }
    }, 300);

    return () => { if (staffSearchDebounce.current) clearTimeout(staffSearchDebounce.current); };
  }, [staffSearch, assignedStaffIds, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.staff) { setFormError('Please select a staff member.'); return; }
    if (!form.shop) { setFormError('Please select a shop.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Store className="h-4 w-4" />
            {editing ? 'Reassign Shop Access' : 'Assign Shop Access'}
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
        <form id="shop-access-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Dynamic Staff search/select */}
          <div>
            <label className={labelCls}>Staff Member <span className="text-red-400 normal-case">*</span></label>
            {selectedStaff ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl max-w-full">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900 truncate">{selectedStaff.full_name}</p>
                  {selectedStaff.staff_id && <p className="text-xs text-blue-600">{selectedStaff.staff_id}</p>}
                </div>
                {!editing && (
                  <button type="button" onClick={() => { setSelectedStaff(null); set('staff', null); setStaffSearch(''); }}
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  onFocus={() => staffSearch.length >= 2 && setShowStaffResults(true)}
                  onBlur={() => setTimeout(() => setShowStaffResults(false), 200)}
                  placeholder="Type staff name to search..."
                  className={`${inputCls} pl-10 pr-10`}
                />
                {isSearchingStaff && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                )}
                {showStaffResults && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {isSearchingStaff ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500 mx-auto" />
                      </div>
                    ) : staffResults.length > 0 ? staffResults.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedStaff(s);
                          set('staff', s.id);
                          setStaffSearch('');
                          setShowStaffResults(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                      >
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <UserCog className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name}</p>
                          {s.staff_id && <p className="text-xs text-slate-400">{s.staff_id}</p>}
                        </div>
                      </button>
                    )) : (
                      <div className="p-4 text-center text-sm text-slate-400">No available staff found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {editing && <p className="text-xs text-slate-400 mt-2">Staff cannot be changed once assigned — remove and re-add instead.</p>}
          </div>

          {/* Shop select */}
          <div>
            <label className={labelCls}>Assigned Shop <span className="text-red-400 normal-case">*</span></label>
            <div className="relative">
              <select value={form.shop ?? ''} onChange={e => set('shop', e.target.value ? Number(e.target.value) : null)} className={`${inputCls} appearance-none pr-9`}>
                <option value="" disabled>Select a shop...</option>
                {shopOptions.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name} {shop.code ? `(${shop.code})` : ''}</option>
                ))}
              </select>
              <Store className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-xs text-slate-400 mt-2">Only one shop at a time — staff can't be in two places.</p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="shop-access-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Reassigning...' : 'Assigning...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Reassign' : 'Assign Access'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ShopAccessPage() {
  const { hasPermission, user } = useAuth();

  const [accessList, setAccessList] = useState<StaffShopAccess[]>([]);
  const [shops, setShops] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingAccess, setEditingAccess] = useState<StaffShopAccess | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingAccess, setDeletingAccess] = useState<StaffShopAccess | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorysettingmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [accessData, locationData] = await Promise.all([
        shopAccessAPI.list(),
        inventoryLocationAPI.list(),
      ]);
      const accessResults = Array.isArray(accessData) ? accessData : accessData?.results || [];
      setAccessList(accessResults);
      setShops((Array.isArray(locationData) ? locationData : []).filter((l: InventoryLocation) => l.location_type === 'shop'));
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingAccess(null); setShowModal(true); };
  const openEdit = (access: StaffShopAccess) => { setEditingAccess(access); setShowModal(true); };

  const handleSave = async (form: ShopAccessFormValues) => {
    setIsSaving(true);
    try {
      if (editingAccess) {
        const updated = await shopAccessAPI.update(editingAccess.id, { shop: form.shop! });
        setAccessList(prev => prev.map(a => a.id === updated.id ? updated : a));
        showToast('success', `Reassigned "${updated.staff_name}" to "${updated.shop_name}"`);
      } else {
        const created = await shopAccessAPI.create({ staff: form.staff!, shop: form.shop! });
        setAccessList(prev => [created, ...prev]);
        showToast('success', `"${created.staff_name}" assigned to "${created.shop_name}"`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingAccess) return;
    setIsDeleting(true);
    try {
      await shopAccessAPI.delete(deletingAccess.id);
      setAccessList(prev => prev.filter(a => a.id !== deletingAccess.id));
      showToast('success', `Removed "${deletingAccess.staff_name}"'s shop access`);
      setDeletingAccess(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingAccess(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = accessList.filter(a => {
    const staffName = a.staff_name || '';
    const shopName = a.shop_name || '';
    return staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           shopName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate assigned staff to pass to the modal to prevent duplicate assignments
  const assignedStaffIds = new Set(accessList.map(a => a.staff));

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingAccess} access={deletingAccess} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingAccess(null)}
      />

      {showModal && (
        <ShopAccessModal
          editing={editingAccess}
          assignedStaffIds={assignedStaffIds}
          shopOptions={shops}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Store className="h-5 w-5 text-white" />
            </div>
            Shop Access
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Restrict staff to a single shop for POS sales</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Assign Access
          </button>
        )}
      </div>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <ShieldOff className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Staff with no shop assigned here cannot process any POS sale. Superusers always bypass this restriction.
        </p>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Assigned Staff', value: accessList.length, icon: UserCog, color: 'from-blue-500 to-blue-600' },
          { label: 'Shops', value: shops.length, icon: ShoppingBag, color: 'from-violet-500 to-purple-600' },
          { label: 'Unassigned Shops', value: Math.max(shops.length - new Set(accessList.map(a => a.shop)).size, 0), icon: AlertCircle, color: 'from-amber-500 to-orange-600' },
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

        {/* Search bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by staff or shop name..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading shop access...</p>
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
              <Store className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm ? 'No assignments match your search' : 'No shop access assigned yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm ? 'Try different keywords.' : 'Until assigned, staff cannot process any sales.'}
            </p>
            {!searchTerm && canManage && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Assign Access
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assigned Shop</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(access => (
                <div key={access.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                  {/* Staff */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserCog className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{access.staff_name}</p>
                  </div>

                  {/* Shop */}
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full whitespace-nowrap">
                      <ShoppingBag className="h-3 w-3" /> {access.shop_name}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button onClick={() => openEdit(access)} title="Reassign shop"
                        className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => setDeletingAccess(access)} title="Remove access"
                        className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {accessList.length} assignment{accessList.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}