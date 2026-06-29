// app/dashboard/staff/inventory/sales/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saleAPI, inventorySettingAPI } from '@/lib/api';
import { Sale, InventorySetting } from '@/lib/types';
import {
  ArrowLeft, Printer, Undo2, AlertCircle, AlertTriangle, Loader2,
  User, UserCog, Store, Hash, Calendar, CreditCard, CheckCircle2,
  Clock, Package, TrendingUp, TrendingDown, Receipt,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function isRefundExpired(sale: Sale, settings: InventorySetting | null): boolean {
  if (!settings?.max_refund_grace_period_hours) return false;
  const deadline = new Date(sale.sale_date).getTime() + settings.max_refund_grace_period_hours * 3600 * 1000;
  return Date.now() > deadline;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', pos: 'POS / Card', student_wallet: 'Student Wallet', staff_wallet: 'Staff Wallet',
};

// ─── Refund Modal ──────────────────────────────────────────────────────────────
function RefundModal({ sale, settings, isRefunding, onConfirm, onCancel }: {
  sale: Sale; settings: InventorySetting | null; isRefunding: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const expired = isRefundExpired(sale, settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
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
              {sale.payment_method.includes('wallet') ? " to the customer's wallet, and" : ' and'} items will be restored to stock.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason for Refund</label>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)} rows={3}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const saleId = Number(params?.id);

  const [sale, setSale] = useState<Sale | null>(null);
  const [settings, setSettings] = useState<InventorySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  const canRefund = user?.is_superuser || hasPermission('inventory.add_salemodel');

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [saleData] = await Promise.all([
        saleAPI.get(saleId),
        inventorySettingAPI.get().then(setSettings).catch(() => {}),
      ]);
      setSale(saleData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [saleId]);

  useEffect(() => { if (saleId) fetchData(); }, [fetchData, saleId]);

  const handleRefundConfirm = async (reason: string) => {
    setIsRefunding(true);
    try {
      const updated = await saleAPI.refund(saleId);
      setSale(updated);
      setShowRefundModal(false);
    } catch (err) {
      alert(extractError(err)); // simple fallback; index page uses toasts, detail keeps it minimal
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePrint = () => {
    if (!sale) return;
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
        <hr/>
        ${(sale.items || []).map(it => `
          <div class="row"><span>${it.item_name} x${it.quantity}</span><span>₦${Number(it.line_total || 0).toLocaleString()}</span></div>
        `).join('')}
        <hr/>
        <div class="row"><span>Subtotal</span><span>₦${Number(sale.subtotal || 0).toLocaleString()}</span></div>
        <div class="row"><span>Discount</span><span>₦${Number(sale.discount || 0).toLocaleString()}</span></div>
        <div class="row total"><span>Total</span><span>₦${Number(sale.total_amount || 0).toLocaleString()}</span></div>
        <hr/>
        ${!isRefunded ? '<p style="text-align:center;">Thank you!</p>' : '<p style="text-align:center; font-weight:bold; color:#b91c1c;">This order has been refunded.</p>'}
      </body></html>
    `;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250); }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (pageError || !sale) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-600">{pageError || 'Order not found.'}</p>
          <button onClick={() => router.push('/dashboard/staff/inventory/sales')}
            className="text-sm text-blue-600 underline">Back to Orders</button>
        </div>
      </div>
    );
  }

  const isRefunded = sale.status === 'refunded';
  const totalProfit = (sale.items || []).reduce((s, it) => s + Number(it.profit || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {showRefundModal && (
        <RefundModal sale={sale} settings={settings} isRefunding={isRefunding}
          onConfirm={handleRefundConfirm} onCancel={() => setShowRefundModal(false)} />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/staff/inventory/sales')}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Order Details</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{sale.transaction_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <Printer className="h-4 w-4" /> Print Receipt
          </button>
          {canRefund && !isRefunded && (
            <button onClick={() => setShowRefundModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all">
              <Undo2 className="h-4 w-4" /> Refund Order
            </button>
          )}
        </div>
      </div>

      {isRefunded && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">This order has been refunded. Stock was restored and the payment was reversed.</p>
        </div>
      )}

      {/* ── Top info cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Order info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-blue-500" /> Order Info
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Transaction:</span>
            <span className="font-mono text-slate-700 truncate">{sale.transaction_id}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Date:</span>
            <span className="text-slate-700">{fmtDateTime(sale.sale_date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Location:</span>
            <span className="text-slate-700">{sale.location_name || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Payment:</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {PAYMENT_LABELS[sale.payment_method] || titleCase(sale.payment_method)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isRefunded ? <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
            <span className="text-slate-500">Status:</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isRefunded ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {titleCase(sale.status)}
            </span>
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-violet-500" /> Customer
          </h3>
          {sale.customer ? (
            <div>
              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-2">Student</span>
              <p className="font-bold text-slate-900">{sale.customer_name}</p>
              {(sale as any).customer_detail?.registration_number && (
                <p className="text-xs text-slate-500 mt-0.5">Reg: {(sale as any).customer_detail.registration_number}</p>
              )}
              {((sale as any).customer_detail?.current_class_name) && (
                <p className="text-xs text-slate-400">
                  {(sale as any).customer_detail.current_class_name} {(sale as any).customer_detail.current_class_section_name || ''}
                </p>
              )}
            </div>
          ) : sale.staff_customer ? (
            <div>
              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-2">Staff</span>
              <p className="font-bold text-slate-900">{sale.staff_customer_name}</p>
              {(sale as any).staff_customer_detail?.department_name && (
                <p className="text-xs text-slate-500 mt-0.5">{(sale as any).staff_customer_detail.department_name}</p>
              )}
            </div>
          ) : (
            <div>
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full mb-2">Walk-in</span>
              <p className="text-sm text-slate-400">No customer information attached to this order.</p>
            </div>
          )}
        </div>

        {/* Processed by */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <UserCog className="h-4 w-4 text-amber-500" /> Processed By
          </h3>
          {(sale as any).created_by_name ? (
            <div>
              <p className="font-bold text-slate-900">{(sale as any).created_by_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Staff who handled this sale</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Not recorded</p>
          )}
        </div>
      </div>

      {/* ── Items table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Order Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Line Total</th>
                <th className="px-4 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(sale.items || []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">No items found in this order.</td></tr>
              ) : (
                sale.items!.map((item, i) => {
                  const profit = Number(item.profit || 0);
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{titleCase(item.item_name || '')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{Number(item.quantity).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtMoney(item.unit_cost)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtMoney(item.line_total)}</td>
                      <td className={`px-4 py-3 text-right font-medium flex items-center justify-end gap-1 ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {profit > 0 ? <TrendingUp className="h-3 w-3" /> : profit < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {profit === 0 ? '₦0.00' : `${profit > 0 ? '+' : ''}${fmtMoney(profit)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-start-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Order Summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-700">{fmtMoney(sale.subtotal)}</span>
          </div>
          {Number(sale.discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-emerald-600">-{fmtMoney(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-800">Total Amount</span>
            <span className="text-lg font-extrabold text-slate-900">{fmtMoney(sale.total_amount)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Profit</span>
            <span className={`text-sm font-bold ${totalProfit > 0 ? 'text-emerald-600' : totalProfit < 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {totalProfit === 0 ? '₦0.00' : `${totalProfit > 0 ? '+' : ''}${fmtMoney(totalProfit)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}