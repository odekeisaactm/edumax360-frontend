'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Printer, ArrowLeft, Loader2, AlertCircle, FileText,
  Users, Star, BookOpen, RefreshCw, GraduationCap, X,
  Layers, ChevronDown, CheckCircle2, AlertTriangle, Download,
  DownloadCloud
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UploadableSection {
  id: number;
  name: string;
  class_config_id: number;
}

interface UploadableClassGroup {
  id: number;
  name: string;
  sections: UploadableSection[];
}

interface UploadableClass {
  id: number;
  name: string;
  class_name: string;
  class_section_name: string | null;
  result_type: string;
  can_have_special_student: boolean;
  form_teacher: number | null;
  assistant_form_teacher: number | null;
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
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

function groupClassesByClassName(classes: UploadableClass[]): UploadableClassGroup[] {
  const groupMap = new Map<string, UploadableClassGroup>();

  for (const cls of classes) {
    const className = cls.class_name;
    if (!groupMap.has(className)) {
      groupMap.set(className, {
        id: cls.id,
        name: className,
        sections: [],
      });
    }

    const group = groupMap.get(className)!;
    group.sections.push({
      id: cls.id,
      name: cls.class_section_name || 'Main',
      class_config_id: cls.id,
    });
  }

  for (const group of groupMap.values()) {
    group.sections.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PrintSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();

  const [classes, setClasses] = useState<UploadableClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [termType, setTermType] = useState<'midterm' | 'end_of_term'>('end_of_term');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Polling State for Bulk Download ──
  const [isPolling, setIsPolling] = useState(false);
  const [pollStatusMessage, setPollStatusMessage] = useState('Initializing...');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      // Fetch all classes (no result_type filter for print)
      const response = await api.get('/api/academic/class-subjects/uploadable/', {
        params: { result_type: 'all' }
      });
      const classData = response.data?.data?.classes || [];
      setClasses(classData);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const classGroups = useMemo(() => groupClassesByClassName(classes), [classes]);

  const selectedClassGroupData = classGroups.find(g => g.name === selectedClassGroup);
  const availableSections = selectedClassGroupData?.sections || [];

  const handleClassChange = (className: string) => {
    setSelectedClassGroup(className);
    setSelectedSection(null);
  };

  const handleViewStudents = () => {
    if (selectedSection) {
      router.push(
        `/dashboard/staff/result/print/students?class=${selectedSection}&type=${termType}`
      );
    }
  };

  const handleDownloadAll = async () => {
    if (!selectedSection) return;

    // Grab period ID from URL params if it exists, otherwise let backend resolve it
    const periodIdParam = searchParams.get('period');

    setIsPolling(true);
    setPollStatusMessage('Queuing download task...');

    try {
      const payload: any = {
        class_config_id: selectedSection,
        comment_type: termType,
      };

      // Only attach period_id if it's explicitly in the URL
      if (periodIdParam) {
        payload.period_id = parseInt(periodIdParam, 10);
      }

      // 1. Trigger the background task
      const res = await api.post('/api/result/detail/bulk-download-pdf/', payload);
      const taskId = res.data.task_id;

      // 2. Start polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/result/detail/bulk-download-status/?task_id=${taskId}`, {
            responseType: 'blob'
          });

          const contentType = statusRes.headers['content-type'];

          if (contentType && contentType.includes('application/zip')) {
            clearInterval(pollInterval);
            setIsPolling(false);

            const disposition = statusRes.headers['content-disposition'];
            let filename = 'results.zip';
            if (disposition && disposition.indexOf('attachment') !== -1) {
              const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
              if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
              }
            }

            const url = window.URL.createObjectURL(new Blob([statusRes.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            showToast('success', 'Bulk download complete!');
          } else {
            const text = await statusRes.data.text();
            const data = JSON.parse(text);

            if (data.status === 'failed') {
              clearInterval(pollInterval);
              setIsPolling(false);
              showToast('error', data.message || 'PDF generation failed.');
            } else {
              setPollStatusMessage(data.message || 'Processing...');
            }
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setIsPolling(false);
          showToast('error', 'Error checking download status.');
        }
      }, 3000);

    } catch (err) {
      setIsPolling(false);
      showToast('error', extractError(err));
    }
  };

  const isFormValid = selectedClassGroup && selectedSection;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <Printer className="h-5 w-5 text-white" />
              </div>
              Print Results
            </h1>
            <p className="text-sm text-slate-400 mt-1 pl-12">Print or download student result cards</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            Select Class & Term Type
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose the class and term type to print results
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : pageError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600">{pageError}</p>
              <button onClick={fetchData} className="mt-3 text-sm text-blue-600 underline">Try Again</button>
            </div>
          ) : classGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No classes available</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                You don't have permission to print results for any class, or no classes exist.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Class and Section Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Select Class <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedClassGroup}
                    onChange={e => handleClassChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select a class</option>
                    {classGroups.map(group => (
                      <option key={group.name} value={group.name}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Select Section <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedSection || ''}
                    onChange={e => setSelectedSection(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    disabled={!selectedClassGroup}
                  >
                    <option value="">{!selectedClassGroup ? 'Select class first' : 'Select a section'}</option>
                    {availableSections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Term Type Selection */}
              <div className="border-t border-slate-100 pt-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Term Type <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-4">
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all flex-1 ${
                      termType === 'end_of_term'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="termType"
                      value="end_of_term"
                      checked={termType === 'end_of_term'}
                      onChange={() => setTermType('end_of_term')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800">End of Term</p>
                      <p className="text-xs text-slate-400">Final results with exam scores</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all flex-1 ${
                      termType === 'midterm'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="termType"
                      value="midterm"
                      checked={termType === 'midterm'}
                      onChange={() => setTermType('midterm')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800">Midterm</p>
                      <p className="text-xs text-slate-400">Mid-term results (CA only)</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={handleViewStudents}
                  disabled={!isFormValid}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
                >
                  <Users className="h-4 w-4" />
                  View Student List
                </button>
                <button
                  onClick={handleDownloadAll}
                  disabled={!isFormValid || isPolling}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  {isPolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download All (ZIP)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Help Text ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Quick Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">1</span>
            </div>
            <span><strong>Select Class & Section:</strong> Choose the class you want to print results for.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">2</span>
            </div>
            <span><strong>Choose Term Type:</strong> Select whether you want End of Term or Midterm results.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">3</span>
            </div>
            <span><strong>View Student List:</strong> See all students and print individual results.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">4</span>
            </div>
            <span><strong>Download All (ZIP):</strong> Bulk download all student result cards as PDFs.</span>
          </div>
        </div>
      </div>

      {/* ── Polling Progress Modal ── */}
      {isPolling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="w-16 h-16 flex items-center justify-center bg-blue-50 rounded-full">
                <DownloadCloud className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Preparing Download</h3>
            <p className="text-sm text-slate-500">{pollStatusMessage}</p>
            <p className="text-xs text-slate-400 mt-4">
              Please do not close this window. This might take a minute depending on the class size.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
