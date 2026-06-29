// app/dashboard/staff/inventory/sales/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saleAPI, inventorySettingAPI } from '@/lib/api';
import { Sale, InventorySetting } from '@/lib/types';
import * as XLSX from 'xlsx';
import {
  ShoppingBag, Search, X, Eye, Printer, Undo2, Plus, Download,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, User, UserCog,
  ChevronDown, FileSpreadsheet, FileText, Clock, Check,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function titleCase(str: string): string {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(amount: string | number | undefined | null): string {
  if (amount == null) return '₦0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0';
  return '₦' + num.toLocaleString('en-NG');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB');
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB');
}

function isRefundExpired(sale: Sale, settings: InventorySetting | null): boolean {
  if (!settings?.max_refund_grace_period_hours) return false;
  const deadline = new Date(sale.sale_date).getTime() + settings.max_refund_grace_period_hours * 3600 * 1000;
  return Date.now() > deadline;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
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

// ─── Customer Cell ─────────────────────────────────────────────────────────────
function CustomerCell({ sale }: { sale: Sale }) {
  const customerDetail = (sale as any).customer_detail;
  const staffDetail = (sale as any).staff_customer_detail;

  if (sale.customer) {
    const classLabel = [customerDetail?.current_class_name, customerDetail?.current_class_section_name]
      .filter(Boolean).join(' ');
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-700">Student</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">{sale.customer_name || '—'}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {customerDetail?.registration_number}{classLabel ? ` • ${classLabel}` : ''}
        </p>
      </div>
    );
  }
  if (sale.staff_customer) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">Staff</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">{sale.staff_customer_name || '—'}</p>
        {staffDetail?.department_name && (
          <p className="text-[11px] text-slate-400 truncate">{staffDetail.department_name}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-slate-400">
      <User className="h-3.5 w-3.5" />
      <span className="text-sm">Walk-in</span>
    </div>
  );
}

// ─── Items Cell ────────────────────────────────────────────────────────────────
function ItemsCell({ sale }: { sale: Sale }) {
  const items = sale.items || [];
  if (items.length === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="space-y-0.5 max-w-[220px]">
      {items.map((it, i) => (
        <p key={i} title={`${it.item_name} × ${Number(it.quantity).toFixed(0)}`} className="text-xs text-slate-600 truncate">
          {titleCase(it.item_name || '')} <span className="text-slate-400">×{Number(it.quantity).toFixed(0)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Refund Modal ──────────────────────────────────────────────────────────────
function RefundModal({ sale, settings, isRefunding, onConfirm, onCancel }: {
  sale: Sale | null;
  settings: InventorySetting | null;
  isRefunding: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  if (!sale) return null;

  const expired = isRefundExpired(sale, settings);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${expired ? 'bg-amber-100' : 'bg-amber-100'}`}>
          {expired ? <Clock className="h-6 w-6 text-amber-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}
        </div>

        {expired ? (
          <>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Refund Window Expired</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              This sale was made on <span className="font-semibold text-slate-700">{fmtDateTime(sale.sale_date)}</span>,
              more than <span className="font-semibold text-slate-700">{settings?.max_refund_grace_period_hours} hour(s)</span> ago.
              Refunds are no longer allowed for this order.
            </p>
            <button onClick={onCancel} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Close
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Refund This Order?</h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              <span className="font-semibold text-slate-700">{fmtMoney(sale.total_amount)}</span> will be reversed
              {sale.payment_method.includes('wallet') ? ' to the customer\'s wallet, and' : ' and'} items will be restored to stock.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason for Refund</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="Why is this order being refunded?"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} disabled={isRefunding}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => onConfirm(reason)} disabled={isRefunding || !reason.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isRefunding ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Undo2 className="h-4 w-4" /> Confirm Refund</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Export Dropdown ───────────────────────────────────────────────────────────
function ExportDropdown({ onExcel, onPdf }: { onExcel: () => void; onPdf: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
        <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden z-30">
          <button onMouseDown={onExcel} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (.xlsx)
          </button>
          <button onMouseDown={onPdf} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-50">
            <FileText className="h-4 w-4 text-red-500" /> PDF Report
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesIndexPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();

  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<InventorySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [refundingSale, setRefundingSale] = useState<Sale | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canSell = user?.is_superuser || hasPermission('inventory.add_inventorysalemodel');
  const canRefund = user?.is_superuser || hasPermission('inventory.add_inventorysalemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    inventorySettingAPI.get().then(setSettings).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page_size: 100 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (customerTypeFilter) params.customer_type = customerTypeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await saleAPI.list(params);
      const results = Array.isArray(data) ? data : data?.results || [];
      setSales(results);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [search, statusFilter, customerTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(fetchData, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const resetFilters = () => {
    setSearch(''); setStatusFilter(''); setCustomerTypeFilter(''); setDateFrom(''); setDateTo('');
  };

  const totalAmount = useMemo(() => sales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0), [sales]);

  // ── Refund flow ──
  const openRefund = (sale: Sale) => setRefundingSale(sale);

  const handleRefundConfirm = async (reason: string) => {
    if (!refundingSale) return;
    setIsRefunding(true);
    try {
      await saleAPI.refund(refundingSale.id);
      showToast('success', `Order ${refundingSale.transaction_id} refunded successfully`);
      setRefundingSale(null);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsRefunding(false);
    }
  };

  // ── Print (single receipt, reuses the same approach as the POS page) ──
  const handlePrint = (sale: Sale) => {
    const isRefunded = sale.status === 'refunded';
    const html = `
      <html><head><title>Receipt - ${sale.transaction_id}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; margin: 0 0 8px; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .total { font-weight: bold; font-size: 14px; }
        .refunded-banner {
          text-align: center; font-weight: bold; color: #b91c1c; border: 2px solid #b91c1c;
          padding: 4px; margin-bottom: 8px; letter-spacing: 1px; transform: rotate(-2deg);
        }
      </style></head>
      <body>
        <h2>Receipt</h2>
        ${isRefunded ? '<div class="refunded-banner">*** REFUNDED ***</div>' : ''}
        <div class="row"><span>Txn:</span><span>${sale.transaction_id}</span></div>
        <div class="row"><span>Date:</span><span>${fmtDateTime(sale.sale_date)}</span></div>
        ${isRefunded ? `<div class="row"><span>Status:</span><span style="color:#b91c1c; font-weight:bold;">REFUNDED</span></div>` : ''}
        <hr/>
        ${(sale.items || []).map(it => `
          <div class="row"><span>${it.item_name} x${it.quantity}</span><span>₦${Number(it.line_total || 0).toLocaleString()}</span></div>
        `).join('')}
        <hr/>
        <div class="row"><span>Subtotal</span><span>₦${Number(sale.subtotal || 0).toLocaleString()}</span></div>
        <div class="row"><span>Discount</span><span>₦${Number(sale.discount || 0).toLocaleString()}</span></div>
        <div class="row total"><span>Total</span><span>₦${Number(sale.total_amount || 0).toLocaleString()}</span></div>
        <hr/>
        ${isRefunded ? '<p style="text-align:center; font-weight:bold; color:#b91c1c;">This order has been refunded.</p>' : ''}
        ${!isRefunded ? '<p style="text-align:center;">Thank you!</p>' : ''}
      </body></html>
    `;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250); }
  };

  // ── Excel export — mirrors the SheetJS pattern used elsewhere in the app ──
  const handleExportExcel = () => {
    const rows = sales.map(s => ({
      'Transaction ID': s.transaction_id,
      'Date': fmtDateTime(s.sale_date),
      'Customer Type': s.customer ? 'Student' : s.staff_customer ? 'Staff' : 'Walk-in',
      'Customer Name': s.customer_name || s.staff_customer_name || 'Walk-in',
      'Items': (s.items || []).map(it => `${it.item_name} x${it.quantity}`).join(', '),
      'Subtotal': Number(s.subtotal || 0),
      'Discount': Number(s.discount || 0),
      'Total': Number(s.total_amount || 0),
      'Payment Method': s.payment_method,
      'Status': s.status,
      'Processed By': (s as any).created_by_name || '—',
      'Location': s.location_name || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    ws['!cols'] = [
      { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 40 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    ];
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── PDF export — generated document, not a page screenshot. Opens in a new
  // tab with a persistent close button (per explicit requirement), distinct
  // from the print stylesheet hack the old Django template used. ──
  const handleExportPdf = () => {
    const rowsHtml = sales.map(s => `
      <tr>
        <td>${s.transaction_id}</td>
        <td>${fmtDateTime(s.sale_date)}</td>
        <td>${s.customer ? 'Student: ' + (s.customer_name || '') : s.staff_customer ? 'Staff: ' + (s.staff_customer_name || '') : 'Walk-in'}</td>
        <td>${(s.items || []).map(it => `${it.item_name} x${it.quantity}`).join('<br/>')}</td>
        <td style="text-align:right;">${fmtMoney(s.total_amount)}</td>
        <td>${titleCase(s.payment_method.replace('_', ' '))}</td>
        <td>${titleCase(s.status)}</td>
        <td>${(s as any).created_by_name || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <html><head><title>Orders Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
        .toolbar { position: sticky; top: 0; background: #fff; padding: 12px 0; display: flex; justify-content: flex-end; gap: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px; }
        .toolbar button { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; }
        .toolbar button.primary { background: #2563eb; color: #fff; border: none; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #64748b; }
        tfoot td { font-weight: bold; border-top: 2px solid #cbd5e1; }
        @media print { .toolbar { display: none; } }
      </style></head>
      <body>
        <div class="toolbar">
          <button class="primary" onclick="window.print()">Print / Save as PDF</button>
          <button onclick="window.close()">Close</button>
        </div>
        <h1>Orders Report</h1>
        <p class="meta">Generated ${fmtDateTime(new Date().toISOString())} — ${sales.length} order(s)</p>
        <table>
          <thead><tr>
            <th>Transaction</th><th>Date</th><th>Customer</th><th>Items</th>
            <th style="text-align:right;">Total</th><th>Payment</th><th>Status</th><th>Processed By</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right;">${fmtMoney(totalAmount)}</td><td colspan="3"></td></tr></tfoot>
        </table>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <RefundModal
        sale={refundingSale} settings={settings} isRefunding={isRefunding}
        onConfirm={handleRefundConfirm} onCancel={() => setRefundingSale(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            All Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View sales history and process refunds</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown onExcel={handleExportExcel} onPdf={handleExportPdf} />
          {canSell && (
            <button onClick={() => router.push('/dashboard/staff/inventory/pos')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Place New Order
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search Transaction ID, Customer..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select value={customerTypeFilter} onChange={e => setCustomerTypeFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Customer Types</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="walkin">Walk-in</option>
          </select>

          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />

          <div className="flex gap-2">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            <button onClick={resetFilters} title="Reset filters"
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Total Orders</p>
          <p className="text-xl font-bold text-slate-800">{loading ? '—' : sales.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Total Value</p>
          <p className="text-xl font-bold text-slate-800">{loading ? '—' : fmtMoney(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hidden sm:block">
          <p className="text-xs text-slate-400">Refunded</p>
          <p className="text-xl font-bold text-amber-600">{loading ? '—' : sales.filter(s => s.status === 'refunded').length}</p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading orders...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No orders found</h3>
            <p className="text-sm text-slate-400">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Processed By</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.map(sale => (
                  <tr key={sale.id} title={sale.transaction_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(sale.sale_date)}</td>
                    <td className="px-4 py-3"><CustomerCell sale={sale} /></td>
                    <td className="px-4 py-3"><ItemsCell sale={sale} /></td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{fmtMoney(sale.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sale.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {titleCase(sale.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[140px]" title={(sale as any).created_by_name || ''}>
                      {(sale as any).created_by_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => router.push(`/dashboard/staff/inventory/sales/${sale.id}`)} title="View Details"
                          className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handlePrint(sale)} title="Print Receipt"
                          className="p-2 rounded-lg text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {canRefund && sale.status === 'completed' && (
                          <button onClick={() => openRefund(sale)} title="Refund Order"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}