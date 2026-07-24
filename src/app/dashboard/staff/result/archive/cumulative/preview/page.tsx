'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { api, studentsAPI, resultSettingsAPI } from '@/lib/api';
import {
  Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight,
  Download, Printer, Mail, X, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const CumulativeResultTemplate = nextDynamic(
  () => import('@/components/result/templates/cumulative/preview'),
  { loading: () => <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" />Loading template...</div>, ssr: false }
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
export default function CumulativePreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentId = searchParams.get('student_id');
  const sessionId = searchParams.get('session_id');
  const classConfigId = searchParams.get('class_config_id');
  const studentIdsParam = searchParams.get('students') || '';

  const studentIds = studentIdsParam ? studentIdsParam.split(',').map(Number) : [];
  const currentIndex = studentIds.length ? studentIds.indexOf(parseInt(studentId!)) : -1;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEmailing, setIsEmailing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!studentId || !sessionId || !classConfigId) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch cumulative data, student info, school info, and settings
      const [cumRes, studentRes, schoolRes, settingsRes] = await Promise.all([
        api.get('/api/result/cumulative/student-cumulative/', {
          params: { student_id: studentId, session_id: sessionId, class_config_id: classConfigId }
        }),
        studentsAPI.get(studentId),
        api.get('/api/school/info/'),
        resultSettingsAPI.get()
      ]);

      setData({
        cumulativeData: cumRes.data,
        student: studentRes,
        schoolInfo: schoolRes.data?.data || schoolRes.data,
        settings: settingsRes,
      });

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load cumulative result data.');
    } finally {
      setLoading(false);
    }
  }, [studentId, sessionId, classConfigId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await api.get('/api/result/cumulative/download-pdf/', {
        params: { student_id: studentId, session_id: sessionId, class_config_id: classConfigId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${data?.student.first_name}_Cumulative_Result.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('success', 'PDF downloaded successfully!');
    } catch (err) {
      showToast('error', extractError(err) || 'Failed to download PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!studentId || !sessionId || !classConfigId) return;
    setIsEmailing(true);
    try {
      await api.post('/api/result/cumulative/send-email/', {
        student_id: parseInt(studentId),
        session_id: parseInt(sessionId),
        class_config_id: parseInt(classConfigId),
      });
      showToast('success', 'Cumulative result emailed successfully!');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsEmailing(false);
    }
  };

  const navigateTo = (newId: number) => {
    router.push(`/dashboard/staff/result/archive/cumulative/preview?student_id=${newId}&session_id=${sessionId}&class_config_id=${classConfigId}&students=${studentIdsParam}`);
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading cumulative report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4 max-w-md">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{error}</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors hover:bg-slate-200">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 print:space-y-0">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Action Bar ── */}
      <div className="sticky top-0 z-10 bg-white rounded-xl border border-slate-100 shadow-lg p-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>

          {studentIds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => navigateTo(studentIds[currentIndex - 1])}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
                title="Previous Student"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600 min-w-[60px] text-center">
                {currentIndex + 1} / {studentIds.length}
              </span>
              <button
                onClick={() => navigateTo(studentIds[currentIndex + 1])}
                disabled={currentIndex >= studentIds.length - 1}
                className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
                title="Next Student"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendEmail}
            disabled={isEmailing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isEmailing ? 'Sending...' : 'Email Result'}
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* ── Template Component ── */}
      <div className="print:mt-0">
        <CumulativeResultTemplate
          student={data.student}
          cumulativeData={data.cumulativeData}
          settings={data.settings}
          schoolInfo={data.schoolInfo}
        />
      </div>
    </div>
  );
}