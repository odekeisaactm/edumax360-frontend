'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { textResultUploadAPI, api } from '@/lib/api';
import {
  Printer, ArrowLeft, Loader2, AlertCircle, Users,
  Eye, Download, CheckCircle2, AlertTriangle, X, RefreshCw,
  User, BookOpen, Calendar, ChevronRight, Search, FileArchive,
  DownloadCloud
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: number;
  name: string;
  reg_number: string;
  image?: string | null;
  gender?: string;
  has_result?: boolean;
}

interface StudentListData {
  class_name: string;
  class_config_id: number;
  period_id: number;
  period_name: string;
  session_name: string;
  students: Student[];
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PrintStudentListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();

  const classId = searchParams.get('class');
  const termType = searchParams.get('type') || 'end_of_term';

  const [data, setData] = useState<StudentListData | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Polling State ──
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadStatusMessage, setDownloadStatusMessage] = useState('Initializing...');

  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!classId) {
      setPageError('Missing class parameter');
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);
    try {
      const response = await textResultUploadAPI.studentList({
        class_config_id: parseInt(classId),
        include_all: true,
      });

      setData(response);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePreview = (studentId: number) => {
    const studentIds = data?.students.map(s => s.id) || [];
    router.push(
      `/dashboard/staff/result/print/preview?student=${studentId}&period=${data?.period_id}&type=${termType}&students=${studentIds.join(',')}`
    );
  };

  const handleDownloadSingle = async (studentId: number) => {
    try {
      const response = await api.get('/api/result/detail/download-pdf/', {
        params: {
          student_id: studentId,
          period_id: data?.period_id,
          comment_type: termType,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const student = data?.students.find(s => s.id === studentId);
      link.setAttribute('download', `${student?.name}_${termType}_result.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleDownloadAll = async () => {
    if (!data) return;

    setDownloadingAll(true);
    setDownloadStatusMessage('Queuing download task...');

    try {
      // 1. Trigger the background task
      const response = await api.post('/api/result/detail/bulk-download-pdf/', {
        class_config_id: data.class_config_id,
        period_id: data.period_id,
        comment_type: termType,
      });

      const taskId = response.data.task_id;

      // 2. Start polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/result/detail/bulk-download-status/?task_id=${taskId}`, {
            responseType: 'blob'
          });

          const contentType = statusRes.headers['content-type'];

          // If backend returns the ZIP file (success state)
          if (contentType && contentType.includes('application/zip')) {
            clearInterval(pollInterval);
            setDownloadingAll(false);

            // Attempt to extract filename from headers
            const disposition = statusRes.headers['content-disposition'];
            let filename = 'results.zip';
            if (disposition && disposition.indexOf('attachment') !== -1) {
              const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
              if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
              }
            }

            // Trigger the browser download
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
            // Still processing: Parse Blob back to JSON to read status message
            const text = await statusRes.data.text();
            const responseData = JSON.parse(text);

            if (responseData.status === 'failed') {
              clearInterval(pollInterval);
              setDownloadingAll(false);
              showToast('error', responseData.message || 'PDF generation failed.');
            } else {
              setDownloadStatusMessage(responseData.message || 'Processing...');
            }
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setDownloadingAll(false);
          showToast('error', 'Error checking download status.');
        }
      }, 3000); // Poll every 3 seconds

    } catch (err) {
      setDownloadingAll(false);
      showToast('error', extractError(err));
    }
  };

  const getStudentImage = (imageUrl: string | null | undefined) => {
    if (imageUrl) {
      return imageUrl;
    }
    return '/images/default-avatar.png';
  };

  const filteredStudents = data?.students.filter(student => {
    const matchSearch = !searchTerm ||
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.reg_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  }) || [];

  const title = termType === 'midterm' ? 'Midterm Results' : 'End of Term Results';
  const headerColor = termType === 'midterm' ? 'from-amber-600 to-orange-600' : 'from-emerald-600 to-teal-600';

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading students...</p>
        </div>
      </div>
    );
  }

  if (pageError || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{pageError || 'Unable to load student list'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
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
              <div className={`w-9 h-9 bg-gradient-to-br ${headerColor} rounded-xl flex items-center justify-center shadow-md`}>
                <Printer className="h-5 w-5 text-white" />
              </div>
              {title}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {data.class_name} · {data.period_name} ({data.session_name})
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-200"
          >
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            Download All (ZIP)
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or registration number..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Student Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No students found</h3>
            <p className="text-sm text-slate-400">
              {searchTerm ? 'Try a different search term' : 'No students in this class'}
            </p>
          </div>
        ) : (
          filteredStudents.map((student, idx) => (
            <div
              key={student.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={getStudentImage(student.image)}
                    alt={student.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{student.name}</p>
                    <p className="text-xs font-mono text-slate-400">{student.reg_number}</p>
                  </div>
                  {student.has_result && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Has Result
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <User className="h-3 w-3" />
                    <span>{student.gender || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreview(student.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      title="Preview Result"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownloadSingle(student.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer Stats ── */}
      <div className="bg-slate-50 rounded-xl p-3 text-center">
        <p className="text-xs text-slate-500">
          Showing {filteredStudents.length} of {data.students.length} student{data.students.length !== 1 ? 's' : ''}
          for {termType === 'midterm' ? 'Midterm' : 'End of Term'}
        </p>
      </div>

      {/* ── Polling Progress Modal ── */}
      {downloadingAll && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="w-16 h-16 flex items-center justify-center bg-emerald-50 rounded-full">
                <DownloadCloud className="h-6 w-6 text-emerald-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Preparing Download</h3>
            <p className="text-sm text-slate-500">{downloadStatusMessage}</p>
            <p className="text-xs text-slate-400 mt-4">
              Please do not close this window. This might take a minute depending on the class size.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}