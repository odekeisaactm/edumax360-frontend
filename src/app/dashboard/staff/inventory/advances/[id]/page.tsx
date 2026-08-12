'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { schoolInfoAPI, inventoryItemAPI } from '@/lib/api';
import { InventoryItemList } from '@/lib/types';
import {
  ArrowLeft, Wallet, CalendarDays, FileText, AlertCircle, Loader2, Package,
  Printer, Building2, Check, User, Ban, Save, Plus, Trash2, Search, X
} from 'lucide-react';

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  disbursed: 'Disbursed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function PurchaseAdvanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { hasPermission, user } = useAuth();

  const [advance, setAdvance] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showPrintA4, setShowPrintA4] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Editable Estimates State (When status === 'pending')
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isSavingEstimates, setIsSavingEstimates] = useState(false);

  // Market Actuals State (Editable when status === 'disbursed')
  const [actuals, setActuals] = useState<Record<number, { qty: string, cost: string }>>({});
  const [isSavingActuals, setIsSavingActuals] = useState(false);

  // Item Search State for Adding Items during Pending phase
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItemList[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, action: string, message: string, payload: any } | null>(null);
  const [approveAmount, setApproveAmount] = useState('');

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorypurchaseadvancemodel');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAdvance = () => {
    setLoading(true);
    api.get(`/api/inventory/advances/${id}/`)
      .then(res => {
        const data = res.data?.data || res.data;
        setAdvance(data);

        // Initialize edit items state for pending edits
        setEditItems(JSON.parse(JSON.stringify(data.items || [])));

        // Initialize actuals state
        const initialActuals: any = {};
        (data.items || []).forEach((item: any) => {
          initialActuals[item.id] = {
            qty: Number(item.quantity_bought) > 0 ? String(item.quantity_bought) : String(item.quantity),
            cost: Number(item.actual_unit_cost) > 0 ? String(item.actual_unit_cost) : String(item.estimated_unit_cost),
          };
        });
        setActuals(initialActuals);
      })
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.message || d?.detail || 'Failed to load advance details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    fetchAdvance();
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced Item Search for Adding Rows
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await inventoryItemAPI.list({ search: searchTerm });
        const results = Array.isArray(res) ? res : (res?.results ?? []);
        setSearchResults(results);
        setShowResults(true);
      } catch {
        showToast('error', 'Failed to search inventory.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAddOfficialItem = (item: InventoryItemList) => {
    setEditItems(prev => [...prev, {
      id: null, // New item flag
      item: item.id,
      item_description: item.name,
      quantity: '1',
      estimated_unit_cost: item.last_cost_price ? String(item.last_cost_price) : '0',
    }]);
    setSearchTerm('');
    setShowResults(false);
  };

  const handleAddCustomItem = () => {
    setEditItems(prev => [...prev, {
      id: null,
      item: null,
      item_description: '',
      quantity: '1',
      estimated_unit_cost: '0',
    }]);
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditItemChange = (index: number, field: string, value: string) => {
    setEditItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSaveEstimates = async () => {
    setIsSavingEstimates(true);
    try {
      const payloadItems = editItems.map(item => ({
        ...(item.id ? { id: item.id } : {}),
        item: item.item || null,
        item_description: item.item_description,
        quantity: Number(item.quantity) || 0,
        estimated_unit_cost: Number(item.estimated_unit_cost) || 0,
      }));

      await api.patch(`/api/inventory/advances/${id}/`, { items: payloadItems });
      showToast('success', 'Advance estimates updated successfully.');
      fetchAdvance();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to update estimates.');
    } finally {
      setIsSavingEstimates(false);
    }
  };

  const executeAction = async () => {
    if (!confirmModal) return;
    setActionLoading(confirmModal.action);
    try {
      await api.patch(`/api/inventory/advances/${id}/`, confirmModal.payload);
      showToast('success', `Action completed successfully.`);
      fetchAdvance();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Action failed.';
      showToast('error', msg);
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleSaveActuals = async () => {
    setIsSavingActuals(true);
    try {
      const itemsPayload = advance.items.map((item: any) => ({
        id: item.id,
        quantity_bought: Number(actuals[item.id].qty),
        actual_unit_cost: Number(actuals[item.id].cost)
      }));

      await api.patch(`/api/inventory/advances/${id}/`, { items: itemsPayload });
      showToast('success', 'Market report actuals saved successfully.');
      fetchAdvance();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || err?.response?.data?.detail || 'Failed to save actuals.');
      setIsSavingActuals(false);
    } finally {
      setIsSavingActuals(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading advance details...</p>
        </div>
      </div>
    );
  }

  if (error || !advance) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/staff/inventory/advances')} className="text-sm text-indigo-600 underline">
            Back to Advances
          </button>
        </div>
      </div>
    );
  }

  const isPending = advance.status === 'pending';
  const isApproved = advance.status === 'approved';
  const isDisbursed = advance.status === 'disbursed';
  const createdBy = advance.created_by_name || 'System Admin';

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">

      {toast && (
        <div className={`fixed top-4 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in
          ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      {/* Print CSS Scope */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #advance-print-area, #advance-print-area * { visibility: visible; }
          #advance-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/inventory/advances')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              Advance Details
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Procurement voucher & reconciliation</p>
          </div>
        </div>

        <button onClick={() => setShowPrintA4(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
          <Printer className="h-4 w-4" /> Print Voucher
        </button>
      </div>

      {/* ── INLINE LAYOUT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT COLUMN: Summary & Actions */}
        <div className="lg:col-span-1 space-y-5">

          {/* Identity Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className={`px-5 py-4 flex items-center justify-between ${advance.status === 'cancelled' ? 'bg-gradient-to-r from-red-500 to-red-600' : advance.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-indigo-600 to-purple-700'}`}>
              <div>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Advance Ref</p>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{advance.advance_number}</p>
              </div>
              <span className="text-xs font-bold bg-white/15 text-white px-3 py-1.5 rounded-lg uppercase tracking-wider">
                {STATUS_LABELS[advance.status] || advance.status}
              </span>
            </div>

            <div className="p-5 space-y-4">
               <div className="flex items-start gap-3">
                 <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Staff Member</p>
                   <p className="text-sm font-semibold text-slate-800">{advance.staff_name}</p>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <CalendarDays className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Request Date</p>
                   <p className="text-sm font-medium text-slate-800">{new Date(advance.request_date).toLocaleDateString('en-GB')}</p>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Prepared By</p>
                   <p className="text-sm font-medium text-slate-800">{createdBy}</p>
                 </div>
               </div>
               <div className="pt-4 border-t border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Purpose</p>
                 <p className="text-sm text-slate-700 leading-relaxed">{advance.purpose}</p>
               </div>
            </div>
          </div>

          {/* Financials Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <span className="text-sm font-semibold text-slate-500">Requested</span>
               <span className="text-lg font-bold text-slate-800">₦{Number(advance.requested_amount).toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <span className="text-sm font-semibold text-sky-600">Approved</span>
               <span className="text-lg font-bold text-sky-900">{Number(advance.approved_amount) > 0 ? `₦${Number(advance.approved_amount).toLocaleString()}` : '—'}</span>
             </div>
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <span className="text-sm font-semibold text-indigo-600">Disbursed</span>
               <span className="text-lg font-bold text-indigo-900">{Number(advance.disbursed_amount) > 0 ? `₦${Number(advance.disbursed_amount).toLocaleString()}` : '—'}</span>
             </div>

             <div className="pt-2">
               <div className="flex justify-between items-end mb-1">
                 <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Market Actuals</span>
                 <span className="text-2xl font-black text-emerald-700">{Number(advance.actual_total) > 0 ? `₦${Number(advance.actual_total).toLocaleString()}` : '—'}</span>
               </div>
               {Number(advance.actual_total) > 0 && (
                 <div className={`p-3 rounded-xl mt-3 ${Number(advance.balance_due) > 0 ? 'bg-amber-50 text-amber-800 border border-amber-100' : Number(advance.balance_due) < 0 ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5">Reconciliation Balance</p>
                    <p className="text-sm font-bold">
                      {Number(advance.balance_due) > 0 ? `Staff Owes ₦${Number(advance.balance_due).toLocaleString()}`
                       : Number(advance.balance_due) < 0 ? `School Owes ₦${Math.abs(Number(advance.balance_due)).toLocaleString()}`
                       : 'Account Settled'}
                    </p>
                 </div>
               )}
             </div>
          </div>

          {/* Actions Card */}
          {canManage && (isPending || isApproved) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Advance Actions</h3>

              <div className="space-y-3">
                {isPending && (
                  <>
                    <button onClick={() => { setApproveAmount(String(advance.requested_amount)); setConfirmModal({ action: 'approve', message: '', payload: null }); }} className="w-full px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
                      <Check className="h-4 w-4" /> Approve Request
                    </button>
                    <button onClick={() => setConfirmModal({ action: 'cancel', message: 'Reject this advance request completely?', payload: { status: 'cancelled' } })} className="w-full px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Ban className="h-4 w-4" /> Reject Request
                    </button>
                  </>
                )}

                {isApproved && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs font-medium leading-relaxed">
                      <Wallet className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                      Approved! The Finance module handles disbursement and final completion of this advance.
                    </div>
                    <button onClick={() => setConfirmModal({ action: 'revert', message: 'Revert this advance back to pending?', payload: { status: 'pending', approved_amount: 0 } })} className="w-full px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <ArrowLeft className="h-4 w-4" /> Revert to Pending
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Items & Actuals Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Market Items</h3>
                  <p className="text-xs text-slate-400">
                    {isPending ? 'Edit estimates or add items while pending' : 'Record actual quantities and costs after the market run'}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Table Header */}
              {isPending && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={handleAddCustomItem} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Custom
                  </button>
                  <button onClick={handleSaveEstimates} disabled={isSavingEstimates} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50">
                    {isSavingEstimates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Estimates
                  </button>
                </div>
              )}

              {isDisbursed && (
                <button onClick={handleSaveActuals} disabled={isSavingActuals} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 disabled:opacity-50 shrink-0">
                  {isSavingActuals ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Actuals
                </button>
              )}
            </div>

            {/* Item Search Bar for Pending Mode */}
            {isPending && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 relative">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search official inventory items to add..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-indigo-500" />}
                </div>
                {showResults && (
                  <div className="absolute z-30 mt-1 w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddOfficialItem(item)}
                        className="w-full flex items-center justify-between p-2.5 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
                      >
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="text-slate-400">Stock: {Number(item.total_quantity).toFixed(0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Desktop Table Header */}
            <div className="hidden sm:grid items-center gap-4 px-6 py-3 bg-slate-50/60 border-b border-slate-100 shrink-0" style={{ gridTemplateColumns: isPending ? 'minmax(140px, 1.5fr) 80px 100px 40px' : 'minmax(150px, 1.5fr) 70px 100px 100px 120px 100px' }}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{isPending ? 'Qty' : 'Est. Qty'}</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{isPending ? 'Cost' : 'Est. Cost'}</span>
              {!isPending && <span className={`text-xs font-semibold uppercase tracking-wide text-right ${isDisbursed ? 'text-indigo-600' : 'text-slate-500'}`}>Act. Qty</span>}
              {!isPending && <span className={`text-xs font-semibold uppercase tracking-wide text-right ${isDisbursed ? 'text-indigo-600' : 'text-slate-500'}`}>Act. Cost</span>}
              <span className={`text-xs font-semibold uppercase tracking-wide text-right ${isDisbursed ? 'text-indigo-600' : 'text-slate-500'}`}>{isPending ? 'Line Total' : 'Act. Total'}</span>
              {isPending && <span />}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-50 overflow-y-auto flex-1">
              {isPending ? (
                // EDITABLE PENDING ITEMS
                editItems.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const cost = Number(item.estimated_unit_cost) || 0;
                  const lineTotal = qty * cost;

                  return (
                    <div key={index} className="flex flex-col sm:grid gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) 80px 100px 40px' }}>
                      <div className="w-full">
                        <input
                          type="text"
                          value={item.item_description}
                          onChange={e => handleEditItemChange(index, 'item_description', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 bg-white"
                          placeholder="Item Description"
                        />
                      </div>
                      <div className="w-full sm:text-right">
                        <input
                          type="number"

                          min="0.01"
                          value={item.quantity}
                          onChange={e => handleEditItemChange(index, 'quantity', e.target.value)}
                          className="w-full sm:w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-right bg-white"
                        />
                      </div>
                      <div className="w-full sm:text-right">
                        <input
                          type="number"

                          min="0"
                          value={item.estimated_unit_cost}
                          onChange={e => handleEditItemChange(index, 'estimated_unit_cost', e.target.value)}
                          className="w-full sm:w-24 px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-right bg-white"
                        />
                      </div>
                      <div className="flex items-center justify-between sm:justify-end w-full">
                        <span className="sm:hidden text-xs font-bold text-slate-400">Total: ₦{lineTotal.toLocaleString()}</span>
                        <button type="button" onClick={() => handleRemoveEditItem(index)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                // VIEW / ACTUALS RECONCILIATION ITEMS
                (advance.items ?? []).map((item: any) => {
                  const actualQty = Number(actuals[item.id]?.qty || item.quantity_bought || 0);
                  const actualCost = Number(actuals[item.id]?.cost || item.actual_unit_cost || 0);
                  const actualTotal = actualQty * actualCost;

                  return (
                    <div key={item.id} className="flex flex-col sm:grid gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors items-center" style={{ gridTemplateColumns: 'minmax(150px, 1.5fr) 70px 100px 100px 120px 100px' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate" title={item.item_description}>
                          {item.item_description || `Item #${item.item}`}
                        </p>
                      </div>
                      <div className="sm:text-right flex justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">Est Qty:</span>
                        <span className="text-sm font-medium text-slate-600">{Number(item.quantity).toLocaleString()}</span>
                      </div>
                      <div className="sm:text-right flex justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">Est Cost:</span>
                        <span className="text-sm font-medium text-slate-600">₦{Number(item.estimated_unit_cost).toLocaleString()}</span>
                      </div>
                      <div className="sm:text-right flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-indigo-500 uppercase">Act Qty:</span>
                        {isDisbursed ? (
                           <input type="number" min="0" value={actuals[item.id]?.qty || ''} onChange={e => setActuals(prev => ({...prev, [item.id]: {...prev[item.id], qty: e.target.value}}))} className="w-20 px-2 py-1 text-sm border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-right font-medium text-indigo-900" />
                        ) : (
                           <span className="text-sm font-medium text-slate-700">{Number(item.quantity_bought) > 0 ? Number(item.quantity_bought).toLocaleString() : '—'}</span>
                        )}
                      </div>
                      <div className="sm:text-right flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-indigo-500 uppercase">Act Cost:</span>
                        {isDisbursed ? (
                           <input type="number" min="0" value={actuals[item.id]?.cost || ''} onChange={e => setActuals(prev => ({...prev, [item.id]: {...prev[item.id], cost: e.target.value}}))} className="w-24 px-2 py-1 text-sm border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-right font-medium text-indigo-900" />
                        ) : (
                           <span className="text-sm font-medium text-slate-700">{Number(item.actual_unit_cost) > 0 ? `₦${Number(item.actual_unit_cost).toLocaleString()}` : '—'}</span>
                        )}
                      </div>
                      <div className="sm:text-right flex justify-between sm:block bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                        <span className="sm:hidden text-[10px] font-bold text-slate-500 uppercase">Act Total:</span>
                        <span className="text-sm font-bold text-indigo-700">
                          {actualTotal > 0 ? `₦${actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {isPending && editItems.length === 0 && (
               <div className="p-8 text-center text-sm text-slate-400">No items in this request yet. Use the search or add custom buttons above.</div>
            )}
          </div>
        </div>

      </div>

      {/* ── Approve Confirm Modal ── */}
      {confirmModal && confirmModal.action === 'approve' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6">
               <h3 className="text-lg font-bold text-slate-900 mb-2">Approve Advance</h3>
               <p className="text-sm text-slate-500 mb-5">Specify the amount approved for this market run. It defaults to the requested amount.</p>
               <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Approved Amount (₦) <span className="text-red-400 normal-case">*</span></label>
               <input type="number" min="0" value={approveAmount} onChange={e => setApproveAmount(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button type="button" onClick={() => {
                  const payload = { status: 'approved', approved_amount: Number(approveAmount), approved_date: new Date().toISOString().split('T')[0] };
                  setActionLoading('approve');
                  api.patch(`/api/inventory/advances/${id}/`, payload)
                    .then(() => { showToast('success', 'Advance approved!'); fetchAdvance(); setConfirmModal(null); })
                    .catch(() => { showToast('error', 'Approval failed.'); })
                    .finally(() => setActionLoading(null));
              }} disabled={!approveAmount || !!actionLoading} className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generic Action Confirm Modal ── */}
      {confirmModal && confirmModal.action !== 'approve' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6">
               <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Action</h3>
               <p className="text-sm text-slate-500">{confirmModal.message}</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button type="button" onClick={executeAction} disabled={!!actionLoading} className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT DOM OVERLAY (A4 VOUCHER) ── */}
      {showPrintA4 && (
        <div onClick={() => setShowPrintA4(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="advance-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintA4(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Voucher</button>
            </div>

            <div className="p-10 print:p-6 text-slate-800">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex items-center gap-4">
                  {schoolInfo?.logo ? (
                    <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-8 w-8 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">{schoolInfo?.name || 'School Name Not Set'}</h1>
                    <p className="text-xs font-medium text-slate-500 mt-1 max-w-sm">{schoolInfo?.address || 'Official Procurement Address'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-widest mb-2">Advance Voucher</h2>
                  <p className="text-sm font-bold text-slate-700">REF #: <span className="font-mono">{advance.advance_number}</span></p>
                  <p className="text-xs font-medium text-slate-500 mt-1">Date: {new Date(advance.request_date).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="flex items-stretch justify-between gap-6 mb-8">
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Issued To (Staff)</p>
                  <p className="text-base font-black text-slate-900">{advance.staff_name}</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Purpose</p>
                  <p className="text-sm font-medium text-slate-800">{advance.purpose}</p>
                </div>
              </div>

              <div className="mb-8 min-h-[200px]">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-800 text-white font-bold">
                    <tr>
                      <th className="px-4 py-2 rounded-tl-lg">Item Description</th>
                      <th className="px-4 py-2 text-right">Est. Qty</th>
                      <th className="px-4 py-2 text-right">Est. Cost</th>
                      <th className="px-4 py-2 text-right rounded-tr-lg">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                    {(advance.items ?? []).map((item: any, i: number) => (
                      <tr key={i} className="break-inside-avoid">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.item_description || `Item #${item.item}`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{Number(item.quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">₦{Number(item.estimated_unit_cost).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">₦{Number(item.line_total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-12 text-sm">
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Requested</p>
                    <p className="font-black text-slate-800">₦{Number(advance.requested_amount).toLocaleString()}</p>
                 </div>
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Approved</p>
                    <p className="font-black text-slate-800">₦{Number(advance.approved_amount).toLocaleString()}</p>
                 </div>
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Disbursed</p>
                    <p className="font-black text-slate-800">₦{Number(advance.disbursed_amount).toLocaleString()}</p>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-12 mt-16 pt-8">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{createdBy}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Prepared By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{advance.approved_by_name || '\u00A0'}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Authorized By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{advance.staff_name || '\u00A0'}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Received By (Staff)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}