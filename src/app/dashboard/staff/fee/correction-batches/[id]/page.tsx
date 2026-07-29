'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import {
  Search, AlertCircle, Check, X, Loader2, FileText,
  ArrowLeft, Wallet, ShieldAlert, Calendar, Printer, User, Building2, Layers, ArrowUpDown
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0" aria-label="Dismiss notification"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Batch Detail Component ───────────────────────────────────────────────
export default function CorrectionBatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.id;
  const { user } = useAuth();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const [loading, setLoading] = useState(true);
  const [batchData, setBatchData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await feeAPI.getCorrectionBatchDetail(Number(batchId));
      setBatchData(res);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatchDetails();
  }, [fetchBatchDetails]);

  // Extract unique classes for filter dropdown
  const availableClasses = useMemo(() => {
    const docs = batchData?.affected_documents || batchData?.execution_log || [];
    const classesSet = new Set<string>();
    docs.forEach((d: any) => {
      if (d.class_name && d.class_name !== 'Family Account') {
        classesSet.add(d.class_name);
      }
    });
    return Array.from(classesSet).sort();
  }, [batchData]);

  // Filter and Sort affected documents
  const filteredDocuments = useMemo(() => {
    const docs = batchData?.affected_documents || batchData?.execution_log || [];
    let filtered = [...docs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d: any) =>
        d.invoice_number?.toLowerCase().includes(q) ||
        d.billed_name?.toLowerCase().includes(q) ||
        d.registration_number?.toLowerCase().includes(q)
      );
    }

    if (channelFilter) {
      filtered = filtered.filter((d: any) => d.payment_channel === channelFilter);
    }

    if (classFilter) {
      filtered = filtered.filter((d: any) => d.class_name === classFilter);
    }

    // Sort by class name
    filtered.sort((a, b) => {
      const classA = (a.class_name || '').toLowerCase();
      const classB = (b.class_name || '').toLowerCase();
      if (classA < classB) return sortOrder === 'asc' ? -1 : 1;
      if (classA > classB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [batchData, searchQuery, channelFilter, classFilter, sortOrder]);

  // Statistics Summary
  const stats = useMemo(() => {
    const docs = batchData?.affected_documents || batchData?.execution_log || [];
    let totalBilled = 0;
    let totalPaid = 0;
    let onlineCount = 0;
    let manualCount = 0;

    docs.forEach((d: any) => {
      totalBilled += parseFloat(d.amount_billed || '0');
      totalPaid += parseFloat(d.amount_paid || '0');
      if (d.payment_channel === 'online') onlineCount++;
      if (d.payment_channel === 'manual') manualCount++;
    });

    return { totalBilled, totalPaid, count: docs.length, onlineCount, manualCount };
  }, [batchData]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!batchData) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Batch audit record not found.</p>
        <button onClick={() => router.push('/dashboard/staff/fee/correction-batches')} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">
          Back to Batches
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header & Navigation ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => router.push('/dashboard/staff/fee/correction-batches')}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title="Back to Batches"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                BAT-{batchData.id.toString().padStart(4, '0')}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{batchData.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Authorized by <strong className="text-slate-700">{batchData.created_by_name || 'Staff'}</strong> on {new Date(batchData.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Printer className="h-4 w-4" /> Print Audit Report
        </button>
      </div>

      {/* ── Reason Callout Box ── */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Rationale / Reason</h3>
          <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{batchData.reason}</p>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Affected Documents</p>
          <p className="text-xl font-black text-slate-800 mt-1">{stats.count}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value Billed</p>
          <p className="text-xl font-black text-slate-800 mt-1">{formatCurrency(stats.totalBilled)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Payments Pivoted</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channel Breakdown</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">Online: {stats.onlineCount}</span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100">Manual: {stats.manualCount}</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, reg no or invoice..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Classes</option>
            {availableClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
          </select>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Channels</option>
            <option value="online">Online (Wallet Refunded)</option>
            <option value="manual">Manual (Re-Upload Req.)</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5 text-slate-700 transition-colors"
            title="Toggle Class Sorting"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" /> Class ({sortOrder.toUpperCase()})
          </button>
        </div>
      </div>

      {/* ── Affected Documents Table ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Affected Invoices &amp; Payment Status Snapshot</h3>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredDocuments.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Billed Entity / Student</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Class &amp; Arm</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Invoice Number</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-right">Amount Billed</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-right">Amount Paid</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-center">Payment Channel</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-center">Wallet Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400 font-medium">
                    No documents match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc: any, i: number) => {
                  const paid = parseFloat(doc.amount_paid || '0');
                  const isOnline = doc.payment_channel === 'online';

                  return (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        {doc.type === 'student' ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded border border-slate-200">Student</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-bold uppercase tracking-widest rounded border border-rose-100">Family</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {doc.image_url ? (
                            <img src={doc.image_url} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {doc.billed_name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{doc.billed_name}</p>
                            {doc.registration_number && <p className="text-[10px] font-mono text-slate-400">{doc.registration_number}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {doc.class_name || '—'} {doc.class_section_name ? `(${doc.class_section_name})` : ''}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{doc.invoice_number}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-800">{formatCurrency(doc.amount_billed)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-600">{formatCurrency(doc.amount_paid)}</td>
                      <td className="px-5 py-3.5 text-center">
                        {isOnline ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-emerald-100">Online</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-amber-100">Manual</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {doc.wallet_funded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-blue-100">
                            <Wallet className="w-3 h-3" /> Funded
                          </span>
                        ) : paid > 0 ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-md border border-slate-200">
                            Re-Upload Req.
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold uppercase tracking-wider">Unpaid</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}