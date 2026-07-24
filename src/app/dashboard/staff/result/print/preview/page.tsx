'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight,
  Download, Printer, X, CheckCircle2, AlertTriangle, Mail, CheckCircle
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
    class_config_id: number;
  };
  result: {
    session_id: number;
    session_name: string;
    period_name: string;
    is_last_term: boolean;
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
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
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

// Template component mapping
const templateComponents: Record<string, any> = {
  'score_1_default': nextDynamic(() => import('@/components/result/templates/score/1_default/preview'), {
    loading: () => <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" />Loading template...</div>,
    ssr: false,
  }),
  'score_2_modern': nextDynamic(() => import('@/components/result/templates/score/2_modern/preview'), {
    loading: () => <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" />Loading template...</div>,
    ssr: false,
  }),
  'score_3_minimal': nextDynamic(() => import('@/components/result/templates/score/3_minimal/preview'), {
    loading: () => <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" />Loading template...</div>,
    ssr: false,
  }),
  'text_1_default': nextDynamic(() => import('@/components/result/templates/text/1_default/preview'), {
    loading: () => <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" />Loading template...</div>,
    ssr: false,
  }),
};

type ReportMode = 'term' | 'cumulative' | 'both';

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentId = searchParams.get('student');
  const periodId = searchParams.get('period');
  const termType = searchParams.get('type') || 'end_of_term';
  const studentIdsParam = searchParams.get('students') || '';

  const studentIds = studentIdsParam ? studentIdsParam.split(',').map(Number) : [];
  const currentIndex = studentIds.length ? studentIds.indexOf(parseInt(studentId!)) : -1;

  const [data, setData] = useState<PrintData | null>(null);
  const [activeTemplates, setActiveTemplates] = useState<ActiveTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Action states
  const [isEmailing, setIsEmailing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Modal States
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'email' | 'download' | null>(null);
  const [selectedReportMode, setSelectedReportMode] = useState<ReportMode>('term');

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!studentId || !periodId) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [printData, templatesData] = await Promise.all([
        api.get('/api/result/detail/print-data/', {
          params: {
            student_id: parseInt(studentId),
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
  }, [studentId, periodId, termType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => window.print();

  // ─── Modal Triggers ───
  const triggerEmail = () => {
    if (data?.result.is_last_term) {
      setPendingAction('email');
      setShowOptionModal(true);
    } else {
      executeSendEmail('term');
    }
  };

  const triggerDownload = () => {
    if (data?.result.is_last_term) {
      setPendingAction('download');
      setShowOptionModal(true);
    } else {
      executeDownloadPDF('term');
    }
  };

  const handleModalConfirm = () => {
    setShowOptionModal(false);
    if (pendingAction === 'email') {
      executeSendEmail(selectedReportMode);
    } else if (pendingAction === 'download') {
      executeDownloadPDF(selectedReportMode);
    }
  };

  // ─── Executers ───
  const executeDownloadPDF = async (mode: ReportMode) => {
    setIsDownloading(true);
    try {
      if (mode === 'term' || mode === 'both') {
        const response = await api.get('/api/result/detail/download-pdf/', {
          params: { student_id: parseInt(studentId!), period_id: parseInt(periodId!), comment_type: termType, download_type: 'term' },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${data?.student.first_name}_${data?.student.last_name}_${termType}_result.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      if (mode === 'cumulative' || mode === 'both') {
        if (mode === 'both') await new Promise(resolve => setTimeout(resolve, 800));
        const response = await api.get('/api/result/detail/download-pdf/', {
          params: { student_id: parseInt(studentId!), period_id: parseInt(periodId!), comment_type: termType, download_type: 'cumulative' },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${data?.student.first_name}_${data?.student.last_name}_Cumulative_Result.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      showToast('success', 'PDF(s) downloaded successfully');
    } catch (err) {
      showToast('error', extractError(err) || 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const executeSendEmail = async (mode: ReportMode) => {
    if (!studentId || !periodId) return;
    setIsEmailing(true);
    try {
      await api.post('/api/result/detail/send-email/', {
        student_id: parseInt(studentId),
        period_id: parseInt(periodId),
        comment_type: termType,
        mail_type: mode,
      });
      showToast('success', 'Result emailed to parent successfully!');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsEmailing(false);
    }
  };

  // ─── Navigation ───
  const handleNext = () => {
    if (currentIndex < studentIds.length - 1 && studentIds.length > 0) {
      const nextStudentId = studentIds[currentIndex + 1];
      router.push(`/dashboard/staff/result/print/preview?student=${nextStudentId}&period=${periodId}&type=${termType}&students=${studentIdsParam}`);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && studentIds.length > 0) {
      const prevStudentId = studentIds[currentIndex - 1];
      router.push(`/dashboard/staff/result/print/preview?student=${prevStudentId}&period=${periodId}&type=${termType}&students=${studentIdsParam}`);
    }
  };

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
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading result preview...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{error || 'Unable to load result data'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 print:space-y-0 relative">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Action Bar (Mobile Responsive & Wrapping) ── */}
      <div className="sticky top-0 z-10 bg-white rounded-xl border border-slate-100 shadow-lg p-3 flex flex-wrap items-center justify-between gap-3 print:hidden">

        {/* Left Side: Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.back()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Go Back">
            <ArrowLeft className="h-4 w-4" />
          </button>

          {studentIds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button onClick={handlePrevious} disabled={currentIndex <= 0} className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Previous Student">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600 min-w-[60px] text-center">
                {currentIndex + 1} / {studentIds.length}
              </span>
              <button onClick={handleNext} disabled={currentIndex >= studentIds.length - 1} className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Next Student">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* View Cumulative Button for Last Term */}
          {TemplateComponent && data.result.is_last_term && (
            <button
              onClick={() => router.push(`/dashboard/staff/result/archive/cumulative/preview?student_id=${studentId}&session_id=${data.result.session_id}&class_config_id=${data.student.class_config_id}&students=${studentIdsParam}`)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-bold rounded-lg hover:bg-amber-200 transition-colors ml-2"
            >
              View Cumulative
            </button>
          )}
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {TemplateComponent && (
            <>
              <button
                onClick={triggerEmail}
                disabled={isEmailing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                <span className="hidden sm:inline">{isEmailing ? 'Sending...' : 'Email'}</span>
              </button>

              <button
                onClick={triggerDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Selection Modal ── */}
      {showOptionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">
                {pendingAction === 'email' ? 'Send Email' : 'Download PDF'}
              </h3>
              <button onClick={() => setShowOptionModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">
                This is the final term. Which report(s) would you like to {pendingAction}?
              </p>

              {/* Radio Options */}
              <div className="space-y-3">
                {[
                  { id: 'term', title: 'Term Report Only', desc: `Sends only the standard ${data.result.period_name} report.` },
                  { id: 'cumulative', title: 'Cumulative Report Only', desc: 'Sends only the full session cumulative performance report.' },
                  { id: 'both', title: 'Both Reports', desc: 'Sends both the term report and the cumulative report together.' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    onClick={() => setSelectedReportMode(opt.id as ReportMode)}
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
                      selectedReportMode === opt.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedReportMode === opt.id ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {selectedReportMode === opt.id && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                      </div>
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${selectedReportMode === opt.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {opt.title}
                      </h4>
                      <p className={`text-xs mt-1 ${selectedReportMode === opt.id ? 'text-indigo-700/80' : 'text-slate-500'}`}>
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowOptionModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="px-6 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm rounded-lg transition-colors flex items-center gap-2"
              >
                {pendingAction === 'email' ? <Mail className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Component ── */}
      <div className="print:mt-0 px-2 sm:px-0 overflow-x-auto">
        {TemplateComponent ? (
          <div className="min-w-[800px]"> {/* Ensures template doesn't squish too much on very small screens, allowing horizontal scroll instead */}
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
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl border border-amber-100 p-8 space-y-3">
              <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-7 w-7 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Template Not Found</h3>
              <p className="text-sm text-slate-500">
                The template "{templateId}" is not available. Use the arrows above to navigate to another student.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}