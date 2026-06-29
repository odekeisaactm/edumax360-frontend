// app/dashboard/staff/inventory/stock-in/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { stockInAPI } from '@/lib/api';
import { StockIn } from '@/lib/types';
import {
  ArrowLeft, PackagePlus, ReceiptText, Building, MapPin,
  CalendarDays, FileText, AlertCircle, Loader2, Package,
  Hash, ShoppingCart,
} from 'lucide-react';

const SOURCE_COLORS: Record<string, string> = {
  purchase:   'bg-blue-50 text-blue-700 border-blue-100',
  return:     'bg-amber-50 text-amber-700 border-amber-100',
  adjustment: 'bg-violet-50 text-violet-700 border-violet-100',
  transfer:   'bg-teal-50 text-teal-700 border-teal-100',
  donation:   'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const SOURCE_LABELS: Record<string, string> = {
  purchase: 'Purchase', return: 'Return', adjustment: 'Adjustment',
  transfer: 'Transfer', donation: 'Donation',
};

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

export default function StockInDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [batch, setBatch] = useState<StockIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    stockInAPI.get(id)
      .then(data => setBatch(data))
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.message || d?.detail || 'Failed to load batch details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading batch details...</p>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/staff/inventory/stock-in')}
            className="text-sm text-emerald-600 underline"
          >
            Back to Stock In History
          </button>
        </div>
      </div>
    );
  }

  const totalCost = batch.total_cost
    ? Number(batch.total_cost)
    : (batch.items ?? []).reduce((sum, i) => sum + Number(i.quantity_received) * Number(i.unit_cost), 0);

  const supplierName = typeof batch.supplier === 'object' && batch.supplier !== null
    ? batch.supplier.name
    : batch.supplier_name ?? null;

  const locationName = typeof batch.location === 'object' && batch.location !== null
    ? batch.location.name
    : batch.location_name ?? String(batch.location);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/inventory/stock-in')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <PackagePlus className="h-5 w-5 text-white" />
            </div>
            Stock In Details
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Batch receipt record</p>
        </div>
      </div>

      {/* ── Receipt Identity Card (full width) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Gradient header strip */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Receipt Number</p>
            <p className="text-xl font-bold text-white font-mono mt-1">{batch.receipt_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${SOURCE_COLORS[batch.source] ?? 'bg-white/20 text-white border-white/20'}`}>
              {SOURCE_LABELS[batch.source] ?? batch.source}
            </span>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ReceiptText className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Meta chips grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaChip
            icon={<CalendarDays className="h-3.5 w-3.5 text-slate-500" />}
            label="Date Received"
            value={new Date(batch.date_received).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric'
            })}
          />
          <MetaChip
            icon={<MapPin className="h-3.5 w-3.5 text-slate-500" />}
            label="Received Into"
            value={locationName}
          />
          <MetaChip
            icon={<Building className="h-3.5 w-3.5 text-slate-500" />}
            label="Supplier"
            value={supplierName ?? <span className="text-slate-400 font-normal text-xs">None</span>}
          />
          <MetaChip
            icon={<ShoppingCart className="h-3.5 w-3.5 text-slate-500" />}
            label="Total Cost"
            value={
              <span className="text-emerald-600">
                ₦{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            }
          />
        </div>

        {/* Notes (if any) */}
        {batch.notes && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{batch.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Items Table (full width) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Items Received</h3>
            <p className="text-xs text-slate-400">
              {batch.items?.length ?? 0} line item{batch.items?.length !== 1 ? 's' : ''} in this batch
            </p>
          </div>
        </div>

        {/* Table header */}
        <div
          className="hidden sm:grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
          style={{ gridTemplateColumns: '2.5rem 1fr 100px 130px 130px 120px 120px' }}
        >
          <span />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Qty</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Unit Cost (₦)</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Line Total (₦)</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch #</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiry</span>
        </div>

        <div className="divide-y divide-slate-50">
          {(batch.items ?? []).map((item, idx) => {
            const lineTotal = item.line_total
              ? Number(item.line_total)
              : Number(item.quantity_received) * Number(item.unit_cost);

            return (
              <div
                key={item.id ?? idx}
                className="grid items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors"
                style={{ gridTemplateColumns: '2.5rem 1fr 100px 130px 130px 120px 120px' }}
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Package className="h-3.5 w-3.5 text-blue-500" />
                </div>

                {/* Name */}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">
                    {item.item_name || `Item #${item.item}`}
                  </p>
                </div>

                {/* Qty */}
                <div className="text-right">
                  <span className="text-sm font-semibold text-slate-700">
                    {Number(item.quantity_received).toLocaleString()}
                  </span>
                </div>

                {/* Unit cost */}
                <div className="text-right">
                  <span className="text-sm text-slate-600">
                    {Number(item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Line total */}
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">
                    {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Batch # */}
                <div>
                  {item.batch_number ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">
                      <Hash className="h-3 w-3" />{item.batch_number}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Expiry */}
                <div>
                  {item.expiry_date ? (
                    <span className="text-xs text-slate-600">
                      {new Date(item.expiry_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer total */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-4">
          <span className="text-sm font-semibold text-slate-500">Total Batch Cost</span>
          <span className="text-xl font-extrabold text-emerald-600">
            ₦{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}