'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWard } from '@/context/WardContext';
import { saleAPI } from '@/lib/api';
import { Sale } from '@/lib/types';
import {
  ShoppingCart, X, AlertCircle, Loader2, RefreshCw,
  Check, ChevronLeft, ChevronRight, Receipt, AlertTriangle,
  Eye, Printer, Store
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

const PAGE_SIZE = 10;

function titleCase(str: string): string {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(amount: string | number | undefined | null): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Builds a compact, title-cased item summary e.g. "Meat Pie x2, Chapman x1" + extra count
function summarizeItems(items: any[]): { primary: string; extraCount: number } {
  if (!items || items.length === 0) return { primary: '—', extraCount: 0 };
  const shown = items.slice(0, 2).map(i => `${titleCase(i.item_name)} x${Number(i.quantity)}`).join(', ');
  return { primary: shown, extraCount: Math.max(0, items.length - 2) };
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[120] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
            'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> :
           t.type === 'error' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" /> :
           <ShoppingCart className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ParentPurchasesPage() {
  const { selectedWard } = useWard();

  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selectedPurchase, setSelectedPurchase] = useState<Sale | null>(null);
  const [printThermalSale, setPrintThermalSale] = useState<Sale | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Data Fetching logic exclusively using saleAPI.list
  const fetchData = useCallback(async (pg = 1) => {
    if (!selectedWard?.id) return;

    setLoading(true);
    setPageError(null);

    try {
      const params: Record<string, any> = {
        page: pg,
        page_size: PAGE_SIZE,
        customer: selectedWard.id
      };

      const data = await saleAPI.list(params);

      let results: Sale[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results?.data) {
        results = data.results.data;
        totalCount = data.count || results.length;
      } else if (data?.results) {
        results = data.results;
        totalCount = data.count || results.length;
      }

      setSales(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err: any) {
      setPageError(err?.response?.data?.detail || err?.message || 'Failed to load purchases.');
    } finally {
      setLoading(false);
    }
  }, [selectedWard?.id]);

  // Initial Load & Refetch when ward changes
  useEffect(() => {
    if (selectedWard?.id) {
      fetchData(1);
    } else {
      setSales([]);
      setTotal(0);
    }
  }, [selectedWard?.id, fetchData]);

  // Escape key to close drawer & print overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPurchase(null);
        setPrintThermalSale(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-print effect
  useEffect(() => {
    if (printThermalSale) {
      const timer = setTimeout(() => { window.print(); }, 150);
      return () => clearTimeout(timer);
    }
  }, [printThermalSale]);

  useEffect(() => {
    const handleAfterPrint = () => { setPrintThermalSale(null); };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageTotalSpent = sales.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  // If no ward is selected in the context
  if (!selectedWard) {
    return (
      <div className="max-w-7xl mx-auto px-4 pb-10">
        <div className="min-h-[500px] flex items-center justify-center">
           <div className="max-w-sm text-center bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertCircle className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No Ward Selected</h3>
              <p className="text-sm text-slate-500">Please select a ward from the top navigation menu to view their tuckshop purchases.</p>
           </div>
        </div>
      </div>
    );
  }

  const wardName = selectedWard?.full_name || `${selectedWard?.first_name || ''} ${selectedWard?.last_name || ''}`.trim() || 'Student';

  return (
    <div className="max-w-7xl mx-auto space-y-3 sm:space-y-6 pb-10 px-3 sm:px-0">

      {/* Print CSS Scope */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex items-center gap-2.5 sm:gap-3 print:hidden">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-slate-900 leading-tight">Tuckshop Purchases</h1>
          <p className="text-[11px] sm:text-sm text-slate-400 truncate">Track <strong>{wardName}'s</strong> spending and receipts</p>
        </div>
      </div>

      {/* ── Stat Strip ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 print:hidden">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm px-2.5 py-2 sm:p-4 flex flex-col justify-center">
          <p className="text-[9px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Purchases</p>
          <p className="text-base sm:text-2xl font-black text-slate-800">{loading && page === 1 ? '—' : total}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm px-2.5 py-2 sm:p-4 flex flex-col justify-center">
          <p className="text-[9px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Page Total</p>
          <p className="text-base sm:text-2xl font-black text-indigo-600 truncate">{loading && page === 1 ? '—' : fmtMoney(pageTotalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm px-2.5 py-2 sm:p-4 flex flex-col justify-center">
          <p className="text-[9px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Refunded</p>
          <p className="text-base sm:text-2xl font-black text-amber-600">{loading && page === 1 ? '—' : sales.filter(p => p.status === 'refunded').length}</p>
        </div>
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
        {loading && sales.length === 0 ? (
          <div className="p-12 sm:p-16 text-center">
            <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-500">Loading purchases...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-600 mb-4">{pageError}</p>
            <button onClick={() => fetchData(page)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 sm:p-16 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-700 text-base sm:text-lg mb-1">No Purchases Found</h3>
            <p className="text-sm text-slate-500">We couldn't find any tuckshop transactions for this ward.</p>
          </div>
        ) : (
          <>
            {/* Desktop Header */}
            <div className="hidden sm:grid items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100"
              style={{ gridTemplateColumns: '100px 1fr 100px 100px 90px' }}>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Items</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* List Body */}
            <div className="divide-y divide-slate-50 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
              )}
              {sales.map((purchase: any) => {
                const { primary, extraCount } = summarizeItems(purchase.items);
                const isRefunded = purchase.status === 'refunded';
                return (
                  <div key={purchase.id} className="sm:grid sm:items-center gap-4 px-3.5 py-2.5 sm:px-5 sm:py-4 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: '100px 1fr 100px 100px 90px' }}>

                    {/* ── Mobile: compact two-line row ── */}
                    <div className="sm:hidden flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold text-slate-400">{fmtDate(purchase.sale_date)}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wide ${
                            isRefunded ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {titleCase(purchase.status || 'Completed')}
                          </span>
                        </div>
                        <p className="text-[12.5px] font-semibold text-slate-700 truncate">
                          {primary}{extraCount > 0 && <span className="text-slate-400 font-medium"> +{extraCount} more</span>}
                        </p>
                      </div>
                      <p className={`text-sm font-black shrink-0 ${isRefunded ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {fmtMoney(purchase.total_amount)}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setSelectedPurchase(purchase)} title="View Receipt"
                          className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setPrintThermalSale(purchase)} title="Print Receipt"
                          className="p-1.5 rounded-lg text-slate-600 bg-slate-50 border border-slate-200">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* ── Desktop: original grid columns ── */}
                    <div className="hidden sm:block">
                      <span className="text-sm font-semibold text-slate-700">{fmtDate(purchase.sale_date)}</span>
                    </div>
                    <div className="hidden sm:flex flex-col min-w-0">
                      <div className="space-y-1">
                        {(purchase.items || []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          purchase.items.map((i: any, idx: number) => (
                            <p key={idx} className="text-[12px] text-slate-700 font-medium truncate">
                              {titleCase(i.item_name)} <span className="text-slate-400 font-semibold ml-1">x{Number(i.quantity)}</span>
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="text-sm font-black text-slate-900">{fmtMoney(purchase.total_amount)}</span>
                    </div>
                    <div className="hidden sm:flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        purchase.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {titleCase(purchase.status || 'Completed')}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedPurchase(purchase)} title="View Receipt"
                        className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => setPrintThermalSale(purchase)} title="Print Receipt"
                        className="p-1.5 rounded-lg text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination block */}
            <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-bold text-slate-700">{total}</span> transactions
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => fetchData(page - 1)} disabled={page === 1}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline text-xs font-bold">Prev</span>
                  </button>
                  <button onClick={() => fetchData(page + 1)} disabled={page === totalPages}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1">
                    <span className="hidden sm:inline text-xs font-bold">Next</span> <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RECEIPT DRAWER (SLIDE-OUT) ── */}
      {selectedPurchase && (
        <div onClick={() => setSelectedPurchase(null)} className="fixed inset-0 z-[100] overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in print:hidden">
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">

            {/* Drawer Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0 relative overflow-hidden">
              <Receipt className="absolute -right-4 -bottom-4 h-24 w-24 text-white opacity-5" />
              <div className="relative z-10">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Digital Receipt</span>
                <h3 className="text-sm sm:text-base font-black truncate max-w-[250px] sm:max-w-[320px] tracking-wide mt-0.5">
                  Transaction Details
                </h3>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors relative z-10">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50">

              {selectedPurchase.status === 'refunded' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Purchase Refunded</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">This transaction was reversed by the school. The amount has been credited back to the wallet.</p>
                  </div>
                </div>
              )}

              {/* Summary Hero */}
              <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
                <p className={`text-3xl sm:text-4xl font-black ${selectedPurchase.status === 'refunded' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {fmtMoney(selectedPurchase.total_amount)}
                </p>
                <div className="flex justify-center items-center gap-2 mt-3">
                  <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-lg">
                    {titleCase(selectedPurchase.payment_method?.replace('_', ' ') || 'Wallet')}
                  </span>
                  <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-lg flex items-center gap-1">
                    <Store className="h-3 w-3" /> {(selectedPurchase as any).location_name || 'Tuckshop'}
                  </span>
                </div>
              </div>

              {/* Metadata Block */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Transaction ID</span>
                  <span className="text-xs font-bold text-slate-800">{selectedPurchase.transaction_id || `Txn #${selectedPurchase.id}`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Date & Time</span>
                  <span className="text-xs font-bold text-slate-800">{fmtDateTime(selectedPurchase.sale_date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Processed By</span>
                  <span className="text-xs font-bold text-slate-800">{(selectedPurchase as any).created_by_name || 'Staff'}</span>
                </div>
              </div>

              {/* Itemized List */}
              <div className="space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Purchased Items</h4>
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-50">
                    {(selectedPurchase.items || []).length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">No items recorded.</div>
                    ) : (
                      selectedPurchase.items.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 flex justify-between items-center gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate">{titleCase(item.item_name) || 'Item'}</p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                              {Number(item.quantity)} x {fmtMoney(item.unit_price)}
                            </p>
                          </div>
                          <p className="text-sm font-black text-slate-900 shrink-0">
                            {fmtMoney(item.line_total || (Number(item.quantity) * Number(item.unit_price)))}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Calculations Footer */}
                  <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                      <span>Subtotal</span>
                      <span>{fmtMoney(selectedPurchase.subtotal)}</span>
                    </div>
                    {Number(selectedPurchase.discount) > 0 && (
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>Discount</span>
                        <span>-{fmtMoney(selectedPurchase.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-800 pt-2 border-t border-slate-200/60 mt-2">
                      <span>Grand Total</span>
                      <span>{fmtMoney(selectedPurchase.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex-shrink-0 flex gap-3">
              <button onClick={() => { setPrintThermalSale(selectedPurchase); setSelectedPurchase(null); }} className="flex-1 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => setSelectedPurchase(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT DOM OVERLAY (THERMAL POS SLIP) ── */}
      {printThermalSale && (
        <div onClick={() => setPrintThermalSale(null)} className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-[300px] rounded-xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full relative">

            {/* Refunded Watermark */}
            {printThermalSale.status === 'refunded' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] text-black font-black text-5xl pointer-events-none uppercase tracking-widest border-4 border-black p-4 rounded-xl z-0 opacity-20">
                Refunded
              </div>
            )}

            <div className="print:hidden flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-100 relative z-10">
              <button onClick={() => setPrintThermalSale(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">Close</button>
              <div className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded animate-pulse">
                Printing...
              </div>
            </div>

            <div className="p-4 print:p-2 text-black font-mono relative z-10" style={{ fontSize: '11px', lineHeight: '1.4' }}>
              <div className="text-center mb-3">
                <h2 className="font-black text-sm uppercase mb-0.5">SCHOOL NAME</h2>
                <p className="text-[9px] mb-0.5">Tuckshop Receipt</p>
              </div>

              <div className="border-b border-dashed border-black mb-3"></div>
              <h3 className="font-bold text-xs mb-3 uppercase text-center tracking-widest">SALES RECEIPT</h3>

              <div className="flex justify-between mb-1 text-[10px]"><span>Ref:</span><span className="font-bold">{printThermalSale.transaction_id || `Txn #${printThermalSale.id}`}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Date:</span><span>{fmtDateTime(printThermalSale.sale_date)}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Customer:</span><span className="font-bold text-right pl-2 truncate">{wardName}</span></div>

              <div className="border-b border-dashed border-black mb-3"></div>

              <div className="w-full mb-3 text-[10px]">
                 <div className="flex justify-between font-bold mb-1 border-b border-black pb-1">
                   <span>Item</span>
                   <span>Total</span>
                 </div>
                 {(printThermalSale.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between mt-1">
                      <span className="pr-2">{titleCase(it.item_name)} <span className="text-[9px]">x{Number(it.quantity)}</span></span>
                      <span className="font-bold">₦{Number(it.line_total || (Number(it.quantity) * Number(it.unit_price))).toLocaleString()}</span>
                    </div>
                 ))}
              </div>

              <div className="border-t border-dashed border-black pt-2 mb-3">
                <div className="flex justify-between mb-1 text-[10px]"><span>Subtotal:</span><span>₦{Number(printThermalSale.subtotal || 0).toLocaleString()}</span></div>
                <div className="flex justify-between mb-1 text-[10px]"><span>Discount:</span><span>₦{Number(printThermalSale.discount || 0).toLocaleString()}</span></div>
                <div className="text-base font-black my-2 flex justify-between items-center border-y-2 border-black py-1.5">
                  <span>TOTAL:</span>
                  <span>{fmtMoney(printThermalSale.total_amount)}</span>
                </div>
                <div className="flex justify-between mt-1 text-[10px]"><span>Paid Via:</span><span className="font-bold uppercase">{printThermalSale.payment_method.replace('_', ' ')}</span></div>
              </div>

              <div className="border-b border-dashed border-black mb-3 mt-3"></div>
              <div className="text-center">
                <p className="text-[10px] font-bold italic mb-1">Thank you for your patronage!</p>
                <p className="text-[9px] mt-2">Cashier: {(printThermalSale as any).created_by_name || 'System'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}