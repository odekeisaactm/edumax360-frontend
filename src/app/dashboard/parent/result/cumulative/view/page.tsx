'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { useWard } from '@/context/WardContext';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, ArrowLeft, Download, Printer,
  X, CheckCircle2, AlertTriangle, Lock, Receipt, Layers
} from 'lucide-react';

// ─── Import Dedicated Cumulative Template ──────────────────────────────────────
const CumulativeResultTemplate = nextDynamic(
  () => import('@/components/result/templates/cumulative/preview'),
  {
    loading: () => (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-3" />
        <p className="text-slate-500 font-medium">Loading template...</p>
      </div>
    ),
    ssr: false
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ParentCumulativeViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedWard } = useWard();

  const sessionId = searchParams.get('session_id');

  const [data, setData] = useState<any>(null);

  // ── States ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Fee Locking States ──
  const [feeBlocked, setFeeBlocked] = useState(false);
  const [feeReason, setFeeReason] = useState("");

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!selectedWard?.id || !sessionId) {
      setError('Missing student or session information.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFeeBlocked(false);

    try {
      // ─── UNIFIED API CALL ───
      // Fetches student, school info, settings, and cumulative data in ONE secure request
      const response = await api.get('/api/result/cumulative/print-data/', {
        params: {
          student_id: selectedWard.id,
          session_id: sessionId
        }
      });

      setData(response.data);

    } catch (err: any) {
      // ── STRICT FEE RESTRICTION CHECK (HTTP 402) ──
      if (err.response && err.response.status === 402) {
        setFeeBlocked(true);
        setFeeReason(err.response.data.reason || "Outstanding fees prevent access to this cumulative result.");
      } else {
        setError(extractError(err) || 'Failed to load cumulative result data.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedWard, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!selectedWard || !sessionId || !data) return;
    setIsDownloading(true);

    try {
      // Assuming your backend download-pdf endpoint handles the unified request logic as well
      const response = await api.get('/api/result/cumulative/download-pdf/', {
        params: {
          student_id: selectedWard.id,
          session_id: sessionId,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const firstName = data.student.first_name.replace(' ', '_');
      const lastName = data.student.last_name.replace(' ', '_');
      const fileName = `${lastName}_${firstName}_Cumulative_Result.pdf`;

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('success', 'Cumulative PDF downloaded successfully!');
    } catch (err) {
      showToast('error', `Failed to download Cumulative PDF. Please try again.`);
    } finally {
      setIsDownloading(false);
    }
  };

  // ── LOADING STATE ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium animate-pulse">Loading secure cumulative data...</p>
      </div>
    );
  }

  // ── FEE BLOCKED MODAL STATE ──
  if (feeBlocked) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
          <div className="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-red-900 text-center">Result Withheld</h2>
            <p className="text-sm font-semibold text-red-700/80 text-center mt-1 uppercase tracking-widest">
              Financial Restriction Active
            </p>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                {feeReason}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard/parent/fees"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200"
              >
                <Receipt className="w-5 h-5" /> View Invoices & Pay
              </Link>
              <button
                onClick={() => router.back()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR STATE ──
  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Denied</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{error || 'Unable to load cumulative result data'}</p>
          <div className="pt-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 print:space-y-0 print:p-0 print:m-0">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Action Bar (Responsive Flex-Wrap) ── */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden transition-all">

        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => router.back()}
            className="p-2 sm:p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-all shadow-sm flex-shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-widest truncate">
              {data.student.first_name} {data.student.last_name}
            </h2>
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-widest truncate mt-0.5 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Cumulative Report
            </p>
          </div>
        </div>

        {/* Buttons wrap neatly on mobile */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex-1 sm:flex-none min-w-[100px] inline-flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-white border-2 border-emerald-600 text-emerald-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? 'Downloading...' : 'PDF'}
          </button>

          <button
            onClick={handlePrint}
            className="flex-none inline-flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Horizontal Wrapper for Mobile ── */}
      <div className="print:m-0 flex justify-center w-full overflow-x-auto pb-6">
        <div className="min-w-[210mm] bg-white print:bg-transparent shadow-2xl print:shadow-none shadow-slate-200/50 rounded-sm overflow-hidden border border-slate-200 print:border-none">
          {/* Passed unified data directly to the template */}
          <CumulativeResultTemplate
            student={data.student}
            cumulativeData={data.cumulativeData}
            settings={data.settings}
            schoolInfo={data.school_info}
          />
        </div>
      </div>

    </div>
  );
}