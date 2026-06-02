'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Users, ArrowLeft, Loader2, AlertCircle, Eye, Upload,
  FileText, Star, User, BookOpen, RefreshCw, X, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: number;
  name: string;
  reg_number: string;
  image?: string | null;
  gender?: string;
}

interface StudentListData {
  class_name: string;
  class_config_id: number;
  period_id: number;
  period_name: string;
  session_name: string;
  students: Student[];
  has_results?: Record<number, boolean>;
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
export default function TextStudentListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const classId = searchParams.get('class');
  const type = searchParams.get('type') || 'text'; // 'text' or 'special'

  const [data, setData] = useState<StudentListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
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
      // API call to get students for this class
      const response = await api.get('/api/result/text-upload/student-list/', {
        params: {
          class_config_id: parseInt(classId),
          student_type: type === 'special' ? 'special' : 'regular',
        },
      });

      setData(response.data);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [classId, type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = (studentId: number) => {
    router.push(`/dashboard/staff/result/upload/text/student?student=${studentId}&class=${classId}&type=${type}`);
  };

  const handleView = (studentId: number) => {
    router.push(`/dashboard/staff/result/view/text/student?student=${studentId}&class=${classId}&type=${type}`);
  };

  const getStudentImage = (imageUrl: string | null | undefined) => {
    if (imageUrl) {
      return imageUrl;
    }
    return '/images/default-avatar.png';
  };

  const title = type === 'special' ? 'Special Needs Result Upload' : 'Text Based Result Upload';
  const icon = type === 'special' ? <Star className="h-5 w-5 text-white" /> : <FileText className="h-5 w-5 text-white" />;
  const headerColor = type === 'special' ? 'from-violet-600 to-purple-600' : 'from-emerald-600 to-teal-600';

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
                {icon}
              </div>
              {title}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {data.class_name} · {data.period_name} ({data.session_name})
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Total Students</p>
          <p className="text-2xl font-bold text-slate-800">{data.students.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Result Type</p>
          <p className="text-sm font-semibold text-slate-800 capitalize mt-1">{type} Based</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Session</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{data.session_name}</p>
        </div>
      </div>

      {/* ── Student Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`bg-gradient-to-r ${headerColor} text-white`}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Student</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Gender</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <div className="text-center">
                      <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <h3 className="font-semibold text-slate-700 mb-1">No Students Found</h3>
                      <p className="text-sm text-slate-400">
                        {type === 'special'
                          ? 'No special needs students found in this class.'
                          : 'No students found in this class.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-500">{idx + 1}.</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.image || '/images/default-avatar.png'}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {student.name}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate uppercase">
                            {student.reg_number}
                          </p>
                        </div>
                      </div>
                    </td>                    <td className="px-5 py-3 text-sm text-slate-600 capitalize">{student.gender || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpload(student.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </button>
                        <button
                          onClick={() => handleView(student.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
          <p className="text-xs text-slate-400">
            Showing {data.students.length} student{data.students.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Instructions ── */}
      <div className={`rounded-2xl p-4 border ${type === 'special' ? 'bg-violet-50 border-violet-100' : 'bg-emerald-50 border-emerald-100'}`}>
        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${type === 'special' ? 'text-violet-800' : 'text-emerald-800'}`}>
          <BookOpen className="h-4 w-4" /> Instructions
        </h3>
        <ul className={`text-xs space-y-1 list-disc list-inside ${type === 'special' ? 'text-violet-700' : 'text-emerald-700'}`}>
          <li>Click "Upload" to enter or edit results for each student</li>
          <li>Results are saved per student for the selected academic period</li>
          <li>Click "View" to see previously uploaded results</li>
          <li>Each field has rating options (e.g., Achieved, Consolidating, Developing)</li>
        </ul>
      </div>
    </div>
  );
}