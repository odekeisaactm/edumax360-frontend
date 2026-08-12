'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { purchaseOrderAPI, stockInAPI, inventoryLocationAPI, schoolInfoAPI } from '@/lib/api';
import api from '@/lib/api';
import { InventoryLocation } from '@/lib/types';
import {
  ArrowLeft, ShoppingCart, CalendarDays, FileText, AlertCircle, Loader2, Package,
  Printer, FileSpreadsheet, Building2, Check, User, Send, Ban, Download, MapPin, X
} from 'lucide-react';

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function MetaChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm font-semibold text-slate-800 truncate mt-0.5">{value}</div>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { hasPermission, user } = useAuth();

  const [po, setPo] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [showPrintA4, setShowPrintA4] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Receive Stock Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveLocation, setReceiveLocation] = useState('');
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [receiveLoading, setReceiveLoading] = useState(false);

  const canManage = user?.is_superuser ||
    hasPermission('inventory.add_inventorypurchaseordermodel') ||
    hasPermission('inventory.add_inventorypurchaseadvancemodel');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPO = () => {
    setLoading(true);
    purchaseOrderAPI.get(id)
      .then(data => setPo(data))
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.message || d?.detail || 'Failed to load PO details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    fetchPO();
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => null);
    inventoryLocationAPI.list().then(data => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      setLocations(arr.filter((l: InventoryLocation) => l.location_type === 'store' || l.location_type === 'shop'));
    }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!showPrintA4) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPrintA4(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintA4]);

  const handleStatusUpdate = async (newStatus: string) => {
    setStatusLoading(newStatus);
    try {
      await api.post(`/api/inventory/purchase-orders/${id}/status/`, { status: newStatus });
      showToast('success', `Purchase Order marked as ${STATUS_LABELS[newStatus]}.`);
      fetchPO();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Status update failed.';
      showToast('error', msg);
    } finally {
      setStatusLoading(null);
    }
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveLocation) {
      showToast('error', 'Please select a receiving location.');
      return;
    }

    setReceiveLoading(true);
    try {
      // 1. Create Stock In[cite: 4]
      const stockInPayload = {
        source: 'purchase',
        purchase_order: po.id,
        supplier: po.supplier,
        location: Number(receiveLocation),
        notes: `Received from PO #${po.order_number}`,
        items: (po.items || []).filter((i: any) => i.item).map((i: any) => ({
          item: i.item,
          purchase_order_item: i.id,
          quantity_received: Number(i.quantity),
          unit_cost: Number(i.unit_cost)
        }))
      };

      await stockInAPI.create(stockInPayload);

      // 2. Mark PO as Received[cite: 7]
      await api.post(`/api/inventory/purchase-orders/${id}/status/`, { status: 'received' });

      showToast('success', 'Stock successfully received and added to inventory!');
      setShowReceiveModal(false);
      fetchPO();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to receive stock.';
      showToast('error', msg);
    } finally {
      setReceiveLoading(false);
    }
  };

  const handleExcel = async () => {
    if (!po) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const sheetRows = (po.items ?? []).map((item: any) => ({
        'Item Description': item.item_description || `Item #${item.item}`,
        'Quantity': parseFloat(String(item.quantity)) || 0,
        'Unit Cost': parseFloat(String(item.unit_cost)) || 0,
        'Line Total': parseFloat(String(item.line_total)) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PO Items');
      XLSX.writeFile(wb, `Purchase_Order_${po.order_number}.xlsx`);
      showToast('success', 'Excel downloaded successfully.');
    } catch (e: any) {
      showToast('error', e?.message || 'Excel export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/staff/inventory/purchase-orders')} className="text-sm text-blue-600 underline">
            Back to Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* Toast Notification */}
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
          #po-print-area, #po-print-area * { visibility: visible; }
          #po-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/inventory/purchase-orders')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              Purchase Order
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Official procurement document</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowPrintA4(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print A4
          </button>
          <button onClick={handleExcel} disabled={exporting} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </button>
        </div>
      </div>

      {/* ── Action Lifecycle Bar ── */}
      {canManage && (po.status === 'draft' || po.status === 'submitted') && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-slate-700">Current Status:</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[po.status]}`}>
              {STATUS_LABELS[po.status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {po.status === 'draft' && (
              <>
                <button onClick={() => handleStatusUpdate('cancelled')} disabled={!!statusLoading} className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {statusLoading === 'cancelled' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel Order
                </button>
                <button onClick={() => handleStatusUpdate('submitted')} disabled={!!statusLoading} className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
                  {statusLoading === 'submitted' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit to Supplier
                </button>
              </>
            )}
            {po.status === 'submitted' && (
              <>
                <button onClick={() => handleStatusUpdate('draft')} disabled={!!statusLoading} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {statusLoading === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} Revert to Draft
                </button>
                <button onClick={() => setShowReceiveModal(true)} className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-bold rounded-xl shadow-sm shadow-emerald-200 transition-colors flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" /> Receive Stock
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Identity Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className={`px-6 py-5 flex items-center justify-between ${po.status === 'cancelled' ? 'bg-gradient-to-r from-red-500 to-red-600' : po.status === 'received' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
          <div>
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Order Number</p>
            <p className="text-xl font-bold text-white font-mono mt-1">{po.order_number}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
            <span className="text-sm font-bold text-white truncate uppercase tracking-wider">{STATUS_LABELS[po.status] || po.status}</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MetaChip icon={<Building2 className="h-3.5 w-3.5 text-blue-500" />} label="Supplier" value={po.supplier_name} />
          <MetaChip icon={<CalendarDays className="h-3.5 w-3.5 text-slate-500" />} label="Order Date" value={new Date(po.order_date).toLocaleDateString('en-GB')} />
          <MetaChip icon={<CalendarDays className="h-3.5 w-3.5 text-amber-500" />} label="Expected By" value={po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GB') : 'Not Set'} />
          <MetaChip icon={<Package className="h-3.5 w-3.5 text-slate-500" />} label="Total Items" value={`${po.items?.length ?? 0} lines`} />
          <MetaChip icon={<User className="h-3.5 w-3.5 text-slate-500" />} label="Created By" value={po.created_by_name || 'System User'} />
        </div>

        {po.notes && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{po.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Items Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Requested Items</h3>
            <p className="text-xs text-slate-400">Itemized cost breakdown</p>
          </div>
        </div>

        <div className="hidden sm:grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100" style={{ gridTemplateColumns: '2.5rem 1fr 100px 140px 140px' }}>
          <span />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Description</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Qty</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Unit Cost</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Line Total</span>
        </div>

        <div className="divide-y divide-slate-50">
          {(po.items ?? []).map((item: any, idx: number) => (
            <div key={item.id ?? idx} className="flex flex-col sm:grid sm:items-center gap-2 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors" style={{ gridTemplateColumns: '2.5rem 1fr 100px 140px 140px' }}>
              <div className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center flex-shrink-0 hidden sm:flex">
                <Package className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 sm:hidden">
                  <Package className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <p className="font-semibold text-sm text-slate-800 truncate">{item.item_description || `Item #${item.item}`}</p>
              </div>
              <div className="sm:text-right pl-11 sm:pl-0 flex justify-between sm:block">
                <span className="sm:hidden text-xs text-slate-400 uppercase font-semibold">Qty:</span>
                <span className="font-bold text-slate-700">{Number(item.quantity).toLocaleString()}</span>
              </div>
              <div className="sm:text-right pl-11 sm:pl-0 flex justify-between sm:block">
                <span className="sm:hidden text-xs text-slate-400 uppercase font-semibold">Cost:</span>
                <span className="text-sm text-slate-600">₦{Number(item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="sm:text-right pl-11 sm:pl-0 flex justify-between sm:block mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                <span className="sm:hidden text-xs text-slate-400 uppercase font-semibold">Total:</span>
                <span className="text-sm font-bold text-blue-600">₦{Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-5 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-6">
          <div className="text-center sm:text-right">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Amount</span>
            <span className="text-2xl font-black text-slate-800">₦{Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* ── RECEIVE STOCK MODAL ── */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <form onSubmit={handleReceiveStock} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" /> Receive Stock
              </h3>
              <button type="button" onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 text-sm mb-5">
                This will create a Stock In record for <strong>{po.items?.length ?? 0} items</strong> from Purchase Order <strong>{po.order_number}</strong>. The PO status will be marked as <strong>Received</strong>.
              </div>

              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Receiving Location <span className="text-red-400 normal-case">*</span></label>
              <div className="relative mb-5">
                <select
                  required
                  value={receiveLocation}
                  onChange={e => setReceiveLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                >
                  <option value="" disabled>Select where to store items...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                  ))}
                </select>
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase">Items to Receive</div>
                <ul className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                  {(po.items ?? []).map((item: any, idx: number) => (
                    <li key={idx} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 truncate pr-4">{item.item_description || `Item #${item.item}`}</span>
                      <span className="font-bold text-emerald-600 shrink-0">+{Number(item.quantity).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowReceiveModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={receiveLoading || !receiveLocation} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                {receiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm Receipt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PRINT DOM OVERLAY (A4) ── */}
      {showPrintA4 && (
        <div onClick={() => setShowPrintA4(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="po-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintA4(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Order</button>
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
                    <p className="text-xs font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-black text-blue-600 uppercase tracking-widest mb-2">Purchase Order</h2>
                  <p className="text-sm font-bold text-slate-700">PO #: <span className="font-mono">{po.order_number}</span></p>
                  <p className="text-xs font-medium text-slate-500 mt-1">Date: {new Date(po.order_date).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="flex items-stretch justify-between gap-6 mb-8">
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vendor / Supplier</p>
                  <p className="text-base font-black text-slate-900">{po.supplier_name}</p>
                  {po.expected_date && (
                    <p className="text-xs font-medium text-blue-700 mt-2 bg-blue-100 inline-block px-2 py-1 rounded-md">Expected Delivery: {new Date(po.expected_date).toLocaleDateString('en-GB')}</p>
                  )}
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ship To</p>
                  <p className="text-sm font-bold text-slate-800">{schoolInfo?.name || 'School Inventory Department'}</p>
                  <p className="text-xs text-slate-600 mt-1">{schoolInfo?.address || 'Main Campus'}</p>
                </div>
              </div>

              <div className="mb-8 min-h-[300px]">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-800 text-white font-bold">
                    <tr>
                      <th className="px-4 py-2 rounded-tl-lg">Description</th>
                      <th className="px-4 py-2 text-right">Quantity</th>
                      <th className="px-4 py-2 text-right">Unit Price</th>
                      <th className="px-4 py-2 text-right rounded-tr-lg">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                    {(po.items ?? []).map((item: any, i: number) => (
                      <tr key={i} className="break-inside-avoid">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.item_description || `Item #${item.item}`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          ₦{Number(item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ₦{Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-4">
                  <div className="w-64">
                    <div className="flex justify-between items-center py-2 text-lg font-black text-slate-900 border-t-2 border-slate-800">
                      <span>Total:</span>
                      <span>₦{Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {po.notes && (
                <div className="mb-8">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Notes / Instructions</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{po.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-12 mt-16 pt-8">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{po.created_by_name || 'System User'}</p>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Authorized Signature</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Supplier Acceptance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}