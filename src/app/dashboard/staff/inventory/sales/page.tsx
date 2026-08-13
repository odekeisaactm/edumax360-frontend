'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saleAPI, inventorySettingAPI, schoolInfoAPI } from '@/lib/api';
import { Sale, InventorySetting } from '@/lib/types';
import * as XLSX from 'xlsx';
import {
  ShoppingBag, Search, X, Eye, Printer, Undo2, Plus, Download,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, User,
  ChevronDown, FileSpreadsheet, FileText, Clock, Check, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

const PAGE_SIZE = 20;

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
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-700 uppercase tracking-wider">Student</span>
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
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700 uppercase tracking-wider">Staff</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">{sale.staff_customer_name || '—'}</p>
        {staffDetail?.department_name && (
          <p className="text-[11px] text-slate-400 truncate">{staffDetail.department_name}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-slate-400 mt-1">
      <User className="h-3.5 w-3.5" />
      <span className="text-sm font-medium">Walk-in</span>
    </div>
  );
}

// ─── Items Cell ────────────────────────────────────────────────────────────────
function ItemsCell({ sale }: { sale: Sale }) {
  const items = sale.items || [];
  if (items.length === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="space-y-0.5 min-w-0 w-full">
      {items.map((it, i) => (
        <p key={i} title={`${it.item_name} × ${Number(it.quantity).toFixed(0)}`} className="text-xs text-slate-600 truncate">
          {titleCase(it.item_name || '')} <span className="text-slate-400 font-medium">×{Number(it.quantity).toFixed(0)}</span>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-100`}>
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<InventorySetting | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [refundingSale, setRefundingSale] = useState<Sale | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  // Print Overlay State
  const [printThermalSale, setPrintThermalSale] = useState<Sale | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, []);

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (customerTypeFilter) params.customer_type = customerTypeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

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
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [search, statusFilter, customerTypeFilter, dateFrom, dateTo]);

  // Debounce filter changes
  useEffect(() => {
    if (loading && page === 1 && !search && !statusFilter && !customerTypeFilter && !dateFrom && !dateTo) return;

    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, customerTypeFilter, dateFrom, dateTo]);

  // Initial Load
  useEffect(() => {
    fetchData(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape key to close print overlay manually
  useEffect(() => {
    if (!printThermalSale) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPrintThermalSale(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printThermalSale]);

  // AUTO-TRIGGER PRINT: Once the thermal slip is rendered to DOM, fire window.print()
  useEffect(() => {
    if (printThermalSale) {
      const timer = setTimeout(() => {
        window.print();
      }, 150); // slight delay to ensure DOM is fully repainted
      return () => clearTimeout(timer);
    }
  }, [printThermalSale]);

  // AUTO-CLOSE MODAL: Listen for when the system print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintThermalSale(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const resetFilters = () => {
    setSearch(''); setStatusFilter(''); setCustomerTypeFilter(''); setDateFrom(''); setDateTo('');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageAmount = useMemo(() => sales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0), [sales]);

  // ── Refund flow ──
  const openRefund = (sale: Sale) => setRefundingSale(sale);

  const handleRefundConfirm = async (reason: string) => {
    if (!refundingSale) return;
    setIsRefunding(true);
    try {
      await saleAPI.refund(refundingSale.id);
      showToast('success', `Order ${refundingSale.transaction_id} refunded successfully`);
      setRefundingSale(null);
      fetchData(page);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsRefunding(false);
    }
  };

  // ── Excel export ──
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

  // ── PDF export ──
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
        <p class="meta">Generated ${fmtDateTime(new Date().toISOString())} — ${sales.length} order(s) on this page</p>
        <table>
          <thead><tr>
            <th>Transaction</th><th>Date</th><th>Customer</th><th>Items</th>
            <th style="text-align:right;">Total</th><th>Payment</th><th>Status</th><th>Processed By</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td colspan="4">PAGE TOTAL</td><td style="text-align:right;">${fmtMoney(pageAmount)}</td><td colspan="3"></td></tr></tfoot>
        </table>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Print CSS Scope */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

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
            <button onClick={() => router.push('/dashboard/staff/inventory/sales/new')}
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
          <p className="text-xs text-slate-400">Total Orders Match</p>
          <p className="text-xl font-bold text-slate-800">{loading && page === 1 ? '—' : total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Page Value</p>
          <p className="text-xl font-bold text-slate-800">{loading && page === 1 ? '—' : fmtMoney(pageAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hidden sm:block">
          <p className="text-xs text-slate-400">Page Refunded</p>
          <p className="text-xl font-bold text-amber-600">{loading && page === 1 ? '—' : sales.filter(s => s.status === 'refunded').length}</p>
        </div>
      </div>

      {/* ── Responsive List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && sales.length === 0 ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading orders...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchData(page)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
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
          <>
            {/* Desktop Header */}
            <div
              className="hidden sm:grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '90px 1.5fr 1.2fr 90px 100px 110px 140px' }}
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Total</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Processed By</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
            </div>

            {/* List Body */}
            <div className="divide-y divide-slate-50 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}
              {sales.map(sale => (
                <div
                  key={sale.id}
                  className="flex flex-col sm:grid sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '90px 1.5fr 1.2fr 90px 100px 110px 140px' }}
                >
                  {/* Date */}
                  <div className="flex items-center justify-between sm:block min-w-0">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Date</span>
                    <span className="text-sm font-medium text-slate-600">{fmtDate(sale.sale_date)}</span>
                  </div>

                  {/* Customer */}
                  <div className="flex flex-col min-w-0">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</span>
                    <CustomerCell sale={sale} />
                  </div>

                  {/* Items */}
                  <div className="flex flex-col min-w-0">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Items</span>
                    <ItemsCell sale={sale} />
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Amount</span>
                    <span className="text-sm font-bold text-slate-800">{fmtMoney(sale.total_amount)}</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between sm:justify-center">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                      sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {titleCase(sale.status)}
                    </span>
                  </div>

                  {/* Processed By */}
                  <div className="flex items-center justify-between sm:block min-w-0">
                    <span className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Processed By</span>
                    <span className="text-xs text-slate-500 truncate" title={(sale as any).created_by_name || ''}>
                      {(sale as any).created_by_name || 'System User'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-1 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-100 sm:border-0">
                    <button onClick={() => router.push(`/dashboard/staff/inventory/sales/${sale.id}`)} title="View Details"
                      className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all flex-shrink-0">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => setPrintThermalSale(sale)} title="Print Slip"
                      className="p-1.5 rounded-lg text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all flex-shrink-0">
                      <Printer className="h-4 w-4" />
                    </button>
                    {canRefund && sale.status === 'completed' && (
                      <button onClick={() => openRefund(sale)} title="Refund Order"
                        className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all flex-shrink-0">
                        <Undo2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination block */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> order{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchData(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchData(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchData(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── PRINT DOM OVERLAY (THERMAL POS SLIP) ── */}
      {printThermalSale && (
        <div onClick={() => setPrintThermalSale(null)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
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
                <h2 className="font-black text-sm uppercase mb-0.5">{schoolInfo?.name || 'SCHOOL NAME'}</h2>
                <p className="text-[9px] mb-0.5">{schoolInfo?.address || 'Address Not Set'}</p>
                <p className="text-[9px]">{schoolInfo?.phone || ''}</p>
              </div>

              <div className="border-b border-dashed border-black mb-3"></div>
              <h3 className="font-bold text-xs mb-3 uppercase text-center tracking-widest">SALES RECEIPT</h3>

              <div className="flex justify-between mb-1 text-[10px]"><span>Ref:</span><span className="font-bold">{printThermalSale.transaction_id}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Date:</span><span>{fmtDateTime(printThermalSale.sale_date)}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Customer:</span><span className="font-bold text-right pl-2 truncate">{printThermalSale.customer_name || printThermalSale.staff_customer_name || 'Walk-in'}</span></div>

              <div className="border-b border-dashed border-black mb-3"></div>

              <div className="w-full mb-3 text-[10px]">
                 <div className="flex justify-between font-bold mb-1 border-b border-black pb-1">
                   <span>Item</span>
                   <span>Total</span>
                 </div>
                 {(printThermalSale.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between mt-1">
                      <span className="pr-2">{it.item_name} <span className="text-[9px]">x{Number(it.quantity)}</span></span>
                      <span className="font-bold">₦{Number(it.line_total).toLocaleString()}</span>
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