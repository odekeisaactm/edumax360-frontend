// app/dashboard/staff/inventory/transfers/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { stockTransferAPI } from '@/lib/api';
import { StockTransfer } from '@/lib/types';
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, ReceiptText, MapPin,
  CalendarDays, FileText, AlertCircle, Loader2, Package,
} from 'lucide-react';

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

export default function StockTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    stockTransferAPI.get(id)
      .then(data => setTransfer(data))
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.message || d?.detail || 'Failed to load transfer details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading transfer details...</p>
        </div>
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/staff/inventory/transfers')}
            className="text-sm text-violet-600 underline"
          >
            Back to Transfers
          </button>
        </div>
      </div>
    );
  }

  const fromName = transfer.from_location_name ?? String(transfer.from_location);
  const toName = transfer.to_location_name ?? String(transfer.to_location);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/inventory/transfers')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            Transfer Details
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Stock movement record</p>
        </div>
      </div>

      {/* ── Receipt Identity Card (full width) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Gradient header strip */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-violet-100 uppercase tracking-widest">Receipt Number</p>
            <p className="text-xl font-bold text-white font-mono mt-1">{transfer.receipt_number}</p>
          </div>
          {/* From → To in the header */}
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
            <span className="text-sm font-semibold text-white truncate max-w-[120px]">{fromName}</span>
            <ArrowRight className="h-4 w-4 text-violet-200 flex-shrink-0" />
            <span className="text-sm font-semibold text-white truncate max-w-[120px]">{toName}</span>
          </div>
        </div>

        {/* Meta chips */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaChip
            icon={<MapPin className="h-3.5 w-3.5 text-slate-500" />}
            label="From"
            value={fromName}
          />
          <MetaChip
            icon={<MapPin className="h-3.5 w-3.5 text-violet-500" />}
            label="To"
            value={toName}
          />
          <MetaChip
            icon={<CalendarDays className="h-3.5 w-3.5 text-slate-500" />}
            label="Transfer Date"
            value={new Date(transfer.transfer_date).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric'
            })}
          />
          <MetaChip
            icon={<Package className="h-3.5 w-3.5 text-slate-500" />}
            label="Total Items"
            value={`${transfer.items?.length ?? 0} line item${transfer.items?.length !== 1 ? 's' : ''}`}
          />
        </div>

        {/* Notes */}
        {transfer.notes && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{transfer.notes}</p>
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
            <h3 className="text-sm font-bold text-slate-800">Items Transferred</h3>
            <p className="text-xs text-slate-400">
              {transfer.items?.length ?? 0} line item{transfer.items?.length !== 1 ? 's' : ''} moved from{' '}
              <span className="font-semibold text-slate-600">{fromName}</span> to{' '}
              <span className="font-semibold text-slate-600">{toName}</span>
            </p>
          </div>
        </div>

        {/* Table header */}
        <div
          className="hidden sm:grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
          style={{ gridTemplateColumns: '2.5rem 1fr 160px' }}
        >
          <span />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Quantity Transferred</span>
        </div>

        <div className="divide-y divide-slate-50">
          {(transfer.items ?? []).map((item, idx) => (
            <div
              key={item.id ?? idx}
              className="grid items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors"
              style={{ gridTemplateColumns: '2.5rem 1fr 160px' }}
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Package className="h-3.5 w-3.5 text-violet-500" />
              </div>

              {/* Name */}
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-800 truncate">
                  {item.item_name || `Item #${item.item}`}
                </p>
              </div>

              {/* Quantity */}
              <div className="text-right">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-violet-50 border border-violet-100 text-sm font-bold text-violet-700">
                  {Number(item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-4">
          <span className="text-sm font-semibold text-slate-500">Total Line Items</span>
          <span className="text-lg font-extrabold text-violet-600">
            {transfer.items?.length ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}