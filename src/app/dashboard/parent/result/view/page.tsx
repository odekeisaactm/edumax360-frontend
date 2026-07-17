'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { useWard } from '@/context/WardContext';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, ArrowLeft, Download, Printer,
  X, CheckCircle2, AlertTriangle
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PrintData {
  student: {
    id: number;
    first_name: string;
    last_name: string;
    registration_number: string;
    image?: string | null;
    gender?: string;
    current_class?: { name: string };
  };
  result: {
    session_name: string;
    period_name: string;
    result_data: Record<string, any>;
    total_score?: number;
    average_score?: number;
    result_type: string;
  };
  behavior_categories: any[];
  behavior_ratings: Record<string, number>;
  comments: any;
  grade_list: any[];
  midterm_grade_list: any[];
  field_list: any[];
  school_info: any;
  settings: {
    primary_color: string;
    secondary_color: string;
    header_color: string;
    accent_color: string;
    midterm_max_score: number | null;
    use_midterm: boolean;
    enable_custom_comment_fields?: boolean;
    custom_comment_fields?: string[];
  };
}

interface ActiveTemplates {
  score: { selected_id: string | null; template: any };
  text: { selected_id: string | null; template: any };
  combined: { selected_id: string | null; template: any };
}

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

// ─── Template Components ───────────────────────────────────────────────────────
const templateComponents: Record<string, any> = {
  'score_1_default': nextDynamic(() => import('@/components/result/templates/score/1_default/preview'), {
    loading: () => <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-slate-500 font-medium">Loading template...</p></div>,
    ssr: false,
  }),
  'score_2_modern': nextDynamic(() => import('@/components/result/templates/score/2_modern/preview'), {
    loading: () => <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-slate-500 font-medium">Loading template...</p></div>,
    ssr: false,
  }),
  'score_3_minimal': nextDynamic(() => import('@/components/result/templates/score/3_minimal/preview'), {
    loading: () => <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-slate-500 font-medium">Loading template...</p></div>,
    ssr: false,
  }),
  'text_1_default': nextDynamic(() => import('@/components/result/templates/text/1_default/preview'), {
    loading: () => <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-slate-500 font-medium">Loading template...</p></div>,
    ssr: false,
  }),
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ParentResultViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedWard } = useWard();

  const periodId = searchParams.get('period');
  const termType = searchParams.get('type') || 'end_of_term';

  const [data, setData] = useState<PrintData | null>(null);
  const [activeTemplates, setActiveTemplates] = useState<ActiveTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!selectedWard?.id || !periodId) {
      setError('Missing student or period information.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [printData, templatesData] = await Promise.all([
        api.get('/api/result/detail/print-data/', {
          params: {
            student_id: selectedWard.id,
            period_id: parseInt(periodId),
            comment_type: termType,
          },
        }),
        api.get('/api/result/templates/active/'),
      ]);

      setData(printData.data);
      setActiveTemplates(templatesData.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedWard, periodId, termType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!selectedWard || !periodId) return;
    setIsDownloading(true);
    try {
      const response = await api.get('/api/result/detail/download-pdf/', {
        params: {
          student_id: selectedWard.id,
          period_id: parseInt(periodId),
          comment_type: termType,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const fileName = `${selectedWard.first_name}_${selectedWard.last_name}_${termType === 'midterm' ? 'Midterm' : 'End_of_Term'}_Result.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('success', 'PDF downloaded successfully!');
    } catch (err) {
      showToast('error', 'Failed to download PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Determine which template to use based on result type
  const getTemplateId = () => {
    if (!data || !activeTemplates) return null;

    const resultType = data.result.result_type;
    if (resultType === 'score') return activeTemplates.score?.selected_id;
    if (resultType === 'text') return activeTemplates.text?.selected_id;
    if (resultType === 'combined') return activeTemplates.combined?.selected_id;
    return null;
  };

  const templateId = getTemplateId();
  const TemplateComponent = templateId ? templateComponents[templateId] : null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-medium animate-pulse">Loading secure result data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Denied</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{error || 'Unable to load result data'}</p>
          <div className="pt-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md"
            >
              <ArrowLeft className="h-4 w-4" /> Go Back to Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 print:space-y-0 print:p-0 print:m-0">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Action Bar (Hidden when printing) ── */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden transition-all">

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => router.back()}
            className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-all shadow-sm flex-shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest truncate">
              {data.student.first_name} {data.student.last_name}
            </h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5">
              {data.result.session_name} • {data.result.period_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {TemplateComponent && (
            <>
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border-2 border-indigo-600 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isDownloading ? 'Saving...' : 'Save PDF'}
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-indigo-200"
              >
                <Printer className="h-4 w-4" />
                Print Result
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Template Component Container ── */}
      <div className="print:m-0 flex justify-center">
        {TemplateComponent ? (
          <div className="bg-white print:bg-transparent shadow-2xl print:shadow-none shadow-slate-200/50 rounded-sm overflow-hidden border border-slate-200 print:border-none">
            <TemplateComponent
              student={data.student}
              result={data.result}
              settings={data.settings}
              behaviorCategories={data.behavior_categories}
              behaviorRatings={data.behavior_ratings}
              comments={data.comments}
              termType={termType}
              gradeList={data.grade_list}
              midtermGradeList={data.midterm_grade_list}
              schoolInfo={data.school_info}
              fieldList={data.field_list}
            />
          </div>
        ) : (
          <div className="min-h-[400px] w-full flex items-center justify-center">
            <div className="max-w-md text-center bg-white rounded-3xl shadow-lg border border-amber-100 p-8 space-y-4">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Template Not Found</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                The school has not assigned a valid layout template for this result type yet.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}