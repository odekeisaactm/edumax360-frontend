'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { stockInAPI, schoolInfoAPI } from '@/lib/api';
import { StockIn } from '@/lib/types';
import {
  ArrowLeft, PackagePlus, ReceiptText, Building, MapPin,
  CalendarDays, FileText, AlertCircle, Loader2, Package,
  Hash, Download, Printer, X, FileSpreadsheet, Building2, Check
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

function fmtMoney(amount: string | number, symbol = '₦'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  return symbol + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

export default function StockInDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [batch, setBatch] = useState<StockIn & { created_by_name?: string } | null>(null);
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
      stockInAPI.get(id),
      schoolInfoAPI.get().catch(() => null)
    ])
      .then(([batchData, schoolData]) => {
        setBatch(batchData);
        if (schoolData) setSchoolInfo(schoolData);
      })
      .catch(err => {
        const d = err?.response?.data;
        setError(d?.error || d?.message || d?.detail || 'Failed to load batch details.');
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
    if (!batch) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const sheetRows = (batch.items ?? []).map((item) => ({
        'Item Name': item.item_name || `Item #${item.item}`,
        'Quantity': parseFloat(String(item.quantity_received)) || 0,
        'Unit Cost': parseFloat(String(item.unit_cost)) || 0,
        'Line Total': parseFloat(String(item.line_total || (Number(item.quantity_received) * Number(item.unit_cost)))) || 0,
        'Batch Number': item.batch_number || 'N/A',
        'Expiry Date': item.expiry_date || 'N/A',
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Received Items');
      XLSX.writeFile(wb, `StockIn_${batch.receipt_number}.xlsx`);
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
          <button onClick={() => router.push('/dashboard/staff/inventory/stock-in')} className="text-sm text-emerald-600 underline">
            Back to Stock In History
          </button>
        </div>
      </div>
    );
  }

  const totalCost = batch.total_cost ? Number(batch.total_cost) : (batch.items ?? []).reduce((sum, i) => sum + Number(i.quantity_received) * Number(i.unit_cost), 0);
  const supplierName = typeof batch.supplier === 'object' && batch.supplier !== null ? batch.supplier.name : batch.supplier_name ?? null;
  const locationName = typeof batch.location === 'object' && batch.location !== null ? batch.location.name : batch.location_name ?? String(batch.location);

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
          <button onClick={() => router.push('/dashboard/staff/inventory/stock-in')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                <PackagePlus className="h-5 w-5 text-white" />
              </div>
              Stock In Details
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Batch receipt record</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowPrintA4(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Printer className="h-4 w-4" /> Print A4
          </button>
          <button onClick={handleExcel} disabled={exporting} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </button>
        </div>
      </div>

      {/* ── Receipt Identity Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Receipt Number</p>
            <p className="text-xl font-bold text-white font-mono mt-1">{batch.receipt_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${SOURCE_COLORS[batch.source] ?? 'bg-white/20 text-white border-white/20'}`}>
              {SOURCE_LABELS[batch.source] ?? batch.source}
            </span>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hidden sm:flex">
              <ReceiptText className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <MetaChip icon={<CalendarDays className="h-3.5 w-3.5 text-slate-500" />} label="Date Received" value={new Date(batch.date_received).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <MetaChip icon={<MapPin className="h-3.5 w-3.5 text-slate-500" />} label="Received Into" value={locationName} />
          <MetaChip icon={<Building className="h-3.5 w-3.5 text-slate-500" />} label="Supplier" value={supplierName ?? <span className="text-slate-400 font-normal text-xs">None</span>} />
          <MetaChip icon={<Package className="h-3.5 w-3.5 text-slate-500" />} label="Received By" value={batch.created_by_name || 'System User'} />
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Total Cost</p>
              <div className="text-sm font-black text-emerald-700 truncate mt-0.5">{fmtMoney(totalCost)}</div>
            </div>
          </div>
        </div>

        {batch.notes && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{batch.notes}</p>
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
            <h3 className="text-sm font-bold text-slate-800">Items Received</h3>
            <p className="text-xs text-slate-400">{batch.items?.length ?? 0} line item{batch.items?.length !== 1 ? 's' : ''} in this batch</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100" style={{ gridTemplateColumns: '1fr 100px 130px 130px 120px 100px' }}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Qty</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Unit Cost</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Line Total</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch #</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiry</span>
            </div>

            <div className="divide-y divide-slate-50">
              {(batch.items ?? []).map((item, idx) => {
                const lineTotal = item.line_total ? Number(item.line_total) : Number(item.quantity_received) * Number(item.unit_cost);
                return (
                  <div key={item.id ?? idx} className="grid items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors" style={{ gridTemplateColumns: '1fr 100px 130px 130px 120px 100px' }}>
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Package className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <Link href={`/dashboard/staff/inventory/items/${item.item}`} className="font-semibold text-sm text-blue-600 hover:text-blue-800 hover:underline truncate">
                        {item.item_name || `Item #${item.item}`}
                      </Link>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-700">{Number(item.quantity_received).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-slate-600">{fmtMoney(item.unit_cost)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-800">{fmtMoney(lineTotal)}</span>
                    </div>
                    <div>
                      {item.batch_number ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">
                          <Hash className="h-3 w-3" />{item.batch_number}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </div>
                    <div>
                      {item.expiry_date ? (
                        <span className="text-xs text-slate-600">
                          {new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── PRINT DOM OVERLAY (A4) ── */}
      {showPrintA4 && (
        <div onClick={() => setShowPrintA4(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowPrintA4(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Receipt</button>
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
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
                  Goods Received Note
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">Ref: {batch.receipt_number}</span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Date: {new Date(batch.date_received).toLocaleDateString('en-GB')}</span>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100 rounded-xl p-4 mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Supplier / Source</p>
                  <p className="text-base font-black text-slate-900 truncate">{supplierName || SOURCE_LABELS[batch.source] || 'Internal'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px]">
                    <span className="font-bold text-slate-500">Destination: {locationName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Total Value Received</p>
                  <p className="text-2xl font-black text-emerald-700 shrink-0 whitespace-nowrap">{fmtMoney(totalCost)}</p>
                </div>
              </div>

              <div className="mb-8">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 border-b border-slate-200">Item Description</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Qty</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Unit Price</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(batch.items ?? []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {item.item_name || `Item #${item.item}`}
                          {item.batch_number && <span className="block text-[9px] text-slate-400 font-normal">Batch: {item.batch_number}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{Number(item.quantity_received).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(item.unit_cost)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmtMoney(item.line_total || Number(item.quantity_received) * Number(item.unit_cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 text-[11px]">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{batch.created_by_name || 'System User'}</p>
                  <p className="text-slate-400 font-medium">Received By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-slate-400 font-medium">Authorized Signature &amp; Stamp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}