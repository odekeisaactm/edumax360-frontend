'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { stockTransferAPI, schoolInfoAPI } from '@/lib/api';
import { StockTransfer } from '@/lib/types';
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, ReceiptText, MapPin,
  CalendarDays, FileText, AlertCircle, Loader2, Package,
  Printer, FileSpreadsheet, Building2, Check, User, X
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

export default function StockTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [transfer, setTransfer] = useState<StockTransfer & { created_by_name?: string } | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [showPrintA4, setShowPrintA4] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      stockTransferAPI.get(id),
      schoolInfoAPI.get().catch(() => null)
    ])
      .then(([transferData, schoolData]) => {
        setTransfer(transferData);
        if (schoolData) setSchoolInfo(schoolData);
      })
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.message || d?.detail || 'Failed to load transfer details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Handle Escape key for print overlay
  useEffect(() => {
    if (!showPrintA4) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPrintA4(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintA4]);

  const handleExcel = async () => {
    if (!transfer) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const sheetRows = (transfer.items ?? []).map((item) => ({
        'Item Name': item.item_name || `Item #${item.item}`,
        'Quantity Transferred': parseFloat(String(item.quantity)) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transferred Items');
      XLSX.writeFile(wb, `Transfer_${transfer.receipt_number}.xlsx`);
      showToast('success', 'Excel manifest downloaded successfully.');
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
          <button onClick={() => router.push('/dashboard/staff/inventory/transfers')} className="text-sm text-violet-600 underline">
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
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/inventory/transfers')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
                <ArrowLeftRight className="h-5 w-5 text-white" />
              </div>
              Transfer Details
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Stock movement record</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowPrintA4(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print A4
          </button>
          <button onClick={handleExcel} disabled={exporting} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-all shadow-sm disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </button>
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
            <span className="text-sm font-semibold text-white truncate max-w-[120px]" title={fromName}>{fromName}</span>
            <ArrowRight className="h-4 w-4 text-violet-200 flex-shrink-0" />
            <span className="text-sm font-semibold text-white truncate max-w-[120px]" title={toName}>{toName}</span>
          </div>
        </div>

        {/* Meta chips */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          <MetaChip
            icon={<User className="h-3.5 w-3.5 text-slate-500" />}
            label="Authorized By"
            value={transfer.created_by_name || 'System User'}
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
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
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
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Quantity Transferred</span>
        </div>

        <div className="divide-y divide-slate-50">
          {(transfer.items ?? []).map((item, idx) => (
            <div
              key={item.id ?? idx}
              className="flex flex-col sm:grid items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors"
              style={{ gridTemplateColumns: '2.5rem 1fr 160px' }}
            >
              {/* Icon - Desktop */}
              <div className="w-8 h-8 rounded-lg bg-violet-50 items-center justify-center flex-shrink-0 hidden sm:flex">
                <Package className="h-3.5 w-3.5 text-violet-500" />
              </div>

              {/* Name & Mobile Icon */}
              <div className="min-w-0 flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 sm:hidden">
                  <Package className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <Link href={`/dashboard/staff/inventory/items/${item.item}`} className="font-semibold text-sm text-violet-600 hover:text-violet-800 hover:underline truncate">
                  {item.item_name || `Item #${item.item}`}
                </Link>
              </div>

              {/* Quantity */}
              <div className="sm:text-right mt-1 sm:mt-0 pl-11 sm:pl-0 w-full sm:w-auto">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-violet-50 border border-violet-100 text-sm font-bold text-violet-700">
                  {Number(item.quantity).toLocaleString()} <span className="text-xs font-semibold text-violet-500 ml-1">units</span>
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

      {/* ── PRINT DOM OVERLAY (A4) ── */}
      {showPrintA4 && (
        <div onClick={() => setShowPrintA4(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintA4(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 shadow-sm shadow-violet-200 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Manifest</button>
            </div>

            <div className="p-8 print:p-6 text-slate-800">
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-5">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{schoolInfo?.address || 'Official Inventory Record'}</p>
                  <p className="text-[11px] font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.phone].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full bg-violet-50 text-violet-700 whitespace-nowrap">
                  Internal Transfer Note
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">Ref: {transfer.receipt_number}</span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Date: {new Date(transfer.transfer_date).toLocaleDateString('en-GB')}</span>
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-slate-50 border border-violet-100 rounded-xl p-4 mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-0.5">Dispatched From</p>
                  <p className="text-base font-black text-slate-900 truncate">{fromName}</p>
                </div>
                <div className="flex items-center px-4">
                   <ArrowRight className="h-5 w-5 text-violet-300" />
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-0.5">Received At</p>
                  <p className="text-base font-black text-slate-900 truncate">{toName}</p>
                </div>
              </div>

              <div className="mb-8">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 border-b border-slate-200">Item Description</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Quantity Transferred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(transfer.items ?? []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {item.item_name || `Item #${item.item}`}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-violet-700">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 text-[11px]">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{transfer.created_by_name || 'System User'}</p>
                  <p className="text-slate-400 font-medium">Authorized / Dispatched By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-slate-400 font-medium">Received By (Destination Rep)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}