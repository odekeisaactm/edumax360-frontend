'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultViewAPI } from '@/lib/api';
import {
  Eye, ArrowLeft, Loader2, AlertCircle, FileText,
  Printer, TrendingUp, Users, Award,
  Calendar, User, BookOpen, CheckCircle2, AlertTriangle, X, RefreshCw,
  Edit3, SortAsc, SortDesc,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Field {
  name: string;
  max_mark: number;
  field_type: 'ca' | 'exam';
  is_midterm: boolean;
  order: number;
}

interface StudentScore {
  student_id: number;
  student_name: string;
  reg_number: string;
  image?: string | null;
  scores: Record<string, number>;
  total_ca?: number;
  total: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
}

interface Statistics {
  highest_score: number;
  lowest_score: number;
  average_score: number;
  total_students: number;
  students_counted: number;
  has_exam: boolean;
  has_ca: boolean;
  updated_at: string;
  updated_by: string;
  midterm_highest?: number;
  midterm_lowest?: number;
  midterm_average?: number;
}

interface SpreadsheetData {
  class_name: string;
  subject_name: string;
  period_name: string;
  session_name: string;
  period_id: number;
  class_config_id: number;
  subject_id: number;
  fields: Field[];
  rows: StudentScore[];
  statistics: Statistics | null;
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

// ─── Statistics Cards ─────────────────────────────────────────────────────────
function StatisticsCards({ stats }: { stats: Statistics | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-100">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-emerald-700">{stats.highest_score}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Highest</p>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-amber-600 rotate-180" />
          </div>
          <span className="text-xl font-bold text-amber-700">{stats.lowest_score}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Lowest</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <Award className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <span className="text-xl font-bold text-blue-700">{stats.average_score}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Average</p>
      </div>

      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-3 border border-violet-100">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
            <Users className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <span className="text-xl font-bold text-violet-700">{stats.students_counted}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Counted</p>
      </div>
    </div>
  );
}

// ─── Print Component ──────────────────────────────────────────────────────────
function PrintableView({ data, sortedRows, caFields, examFields }: {
  data: SpreadsheetData;
  sortedRows: StudentScore[];
  caFields: Field[];
  examFields: Field[];
}) {
  return (
    <div className="hidden print:block p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{data.class_name}</h1>
        <h2 className="text-xl font-semibold text-slate-700 mt-1">{data.subject_name} Result</h2>
        <p className="text-sm text-slate-500 mt-1">{data.period_name} ({data.session_name})</p>
      </div>

      {/* Statistics summary for print */}
      {data.statistics && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border rounded-lg p-3">
          <div><span className="font-semibold">Highest:</span> {data.statistics.highest_score}</div>
          <div><span className="font-semibold">Lowest:</span> {data.statistics.lowest_score}</div>
          <div><span className="font-semibold">Average:</span> {data.statistics.average_score}</div>
          <div><span className="font-semibold">Students:</span> {data.statistics.students_counted}</div>
        </div>
      )}

      {/* Results table for print */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left">S/N</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Student</th>
              {caFields.map(field => (
                <th key={field.name} className="border border-slate-300 px-3 py-2 text-center">{field.name.toUpperCase()}</th>
              ))}
              {caFields.length > 0 && (
                <th className="border border-slate-300 px-3 py-2 text-center bg-blue-50">Total CA</th>
              )}
              {examFields.map(field => (
                <th key={field.name} className="border border-slate-300 px-3 py-2 text-center">{field.name.toUpperCase()}</th>
              ))}
              <th className="border border-slate-300 px-3 py-2 text-center bg-emerald-50">Total</th>
              <th className="border border-slate-300 px-3 py-2 text-center">Grade</th>
              <th className="border border-slate-300 px-3 py-2 text-center">Remark</th>
              <th className="border border-slate-300 px-3 py-2 text-center">Pos</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((student, idx) => (
              <tr key={student.student_id} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2">{idx + 1}</td>
                <td className="border border-slate-300 px-3 py-2">
                  <div className="font-bold">{student.student_name}</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">{student.reg_number}</div>
                </td>
                {caFields.map(field => (
                  <td key={field.name} className="border border-slate-300 px-3 py-2 text-center">
                    {student.scores[field.name] !== undefined ? student.scores[field.name] : '-'}
                  </td>
                ))}
                {caFields.length > 0 && (
                  <td className="border border-slate-300 px-3 py-2 text-center bg-blue-50">
                    {student.total_ca !== undefined ? student.total_ca : '-'}
                  </td>
                )}
                {examFields.map(field => (
                  <td key={field.name} className="border border-slate-300 px-3 py-2 text-center">
                    {student.scores[field.name] !== undefined ? student.scores[field.name] : '-'}
                  </td>
                ))}
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                  {student.total !== null ? student.total : '-'}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-center">{student.grade || '-'}</td>
                <td className="border border-slate-300 px-3 py-2 text-center">{student.remark || '-'}</td>
                <td className="border border-slate-300 px-3 py-2 text-center">{student.position || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-center text-slate-400 border-t pt-3">
        Printed on {new Date().toLocaleString()}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ViewScoreResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const classId = searchParams.get('class');
  const subjectId = searchParams.get('subject');

  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canUpdate = user?.is_superuser || hasPermission('result.change_resultmodel');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!classId || !subjectId) {
      setPageError('Missing required parameters');
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);
    try {
      const response = await resultViewAPI.subjectSpreadsheet({
        class_config_id: parseInt(classId),
        subject_id: parseInt(subjectId),
      });

      // Calculate total_ca for each student
      const rowsWithTotalCa = response.rows.map((student: StudentScore) => {
        const caFields = (response.fields as any[]).filter((f: any) => f.field_type === 'ca');
        const totalCa = caFields.reduce((sum: number, field: any) => {
          const score = student.scores[field.name];
          return sum + (typeof score === 'number' ? score : 0);
        }, 0);

        return {
          ...student,
          total_ca: totalCa as any
        };
      });

      setData({
        ...response,
        class_config_id: parseInt(classId),
        subject_id: parseInt(subjectId),
        period_id: (response as any).period_id || 0,
        rows: rowsWithTotalCa,
      } as any);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleUpdate = () => {
    router.push(`/dashboard/staff/result/upload/score?class=${classId}&subject=${subjectId}`);
  };

  const toggleSort = () => {
    if (sortBy === 'score') {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy('score');
      setSortOrder('desc');
    }
  };

  const sortByName = () => {
    setSortBy('name');
    setSortOrder('asc');
  };

  const getSortedRows = () => {
    if (!data) return [];

    const rows = [...data.rows];
    if (sortBy === 'score') {
      rows.sort((a, b) => {
        const scoreA = a.total || 0;
        const scoreB = b.total || 0;
        return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      });
    } else {
      rows.sort((a, b) => {
        return a.student_name.localeCompare(b.student_name);
      });
    }
    return rows;
  };

  const getFieldLabel = (field: Field) => {
    return field.name.toUpperCase();
  };

  const getStudentImage = (imageUrl: string | null | undefined) => {
    if (imageUrl) {
      return imageUrl;
    }
    return '/images/default-avatar.png';
  };

  const sortedRows = getSortedRows();

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading results...</p>
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
          <p className="text-sm text-slate-500">{pageError || 'Unable to load result data'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const caFields = data.fields.filter(f => f.field_type === 'ca');
  const examFields = data.fields.filter(f => f.field_type === 'exam');

  return (
    <>
      {/* Print view - only visible when printing */}
      <PrintableView
        data={data}
        sortedRows={sortedRows}
        caFields={caFields}
        examFields={examFields}
      />

      {/* Regular view - hidden when printing */}
      <div className="space-y-6 pb-10 print:hidden">
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
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                Score Result View
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {data.class_name} · {data.subject_name} · {data.period_name} ({data.session_name})
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={sortByName}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortBy === 'name' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sort by Name
              </button>
              <button
                onClick={toggleSort}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                  sortBy === 'score' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sort by Score
                {sortBy === 'score' && (
                  sortOrder === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />
                )}
              </button>
            </div>
            {canUpdate && (
              <button
                onClick={handleUpdate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                <Edit3 className="h-4 w-4" />
                Update Result
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={() => fetchData()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Statistics Summary ── */}
        <StatisticsCards stats={data.statistics} />

        {/* ── Upload Info Card ── */}
        {data.statistics && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                {data.statistics.updated_at}
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <User className="h-3.5 w-3.5" />
                By: {data.statistics.updated_by || 'System'}
              </span>
            </div>
            <div className="flex gap-2">
              {data.statistics.has_ca && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-medium">CA Included</span>
              )}
              {data.statistics.has_exam && (
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-medium">Exam Included</span>
              )}
            </div>
          </div>
        )}

        {/* ── Results Table ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full min-w-[800px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="sticky left-0 bg-gradient-to-r from-blue-600 to-indigo-600 z-30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide min-w-[250px] rounded-tl-2xl">
                      Student
                    </th>
                    {caFields.map(field => (
                      <th key={field.name} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                        {getFieldLabel(field)}
                      </th>
                    ))}
                    {caFields.length > 0 && (
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap bg-blue-500">
                        Total CA
                      </th>
                    )}
                    {examFields.map(field => (
                      <th key={field.name} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                        {getFieldLabel(field)}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap bg-emerald-600">
                      Total
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Grade
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Remark
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Pos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((student, idx) => (
                    <tr key={student.student_id} className={`transition-colors ${
                      idx % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-slate-50/30 hover:bg-blue-50/30'
                    }`}>
                      <td className="sticky left-0 z-10 px-4 py-3 bg-inherit">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-6">{idx + 1}.</span>
                          <img
                            src={getStudentImage(student.image)}
                            alt={student.student_name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate max-w-[180px]">
                              {student.student_name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate uppercase">
                              {student.reg_number}
                            </div>
                          </div>
                        </div>
                       </td>
                      {caFields.map(field => (
                        <td key={field.name} className="px-3 py-2 text-center">
                          <span className="text-sm text-slate-700">
                            {student.scores[field.name] !== undefined ? student.scores[field.name] : '-'}
                          </span>
                         </td>
                      ))}
                      {caFields.length > 0 && (
                        <td className="px-3 py-2 text-center bg-blue-50">
                          <span className="text-sm font-semibold text-blue-700">
                            {student.total_ca !== undefined ? student.total_ca : '-'}
                          </span>
                         </td>
                      )}
                      {examFields.map(field => (
                        <td key={field.name} className="px-3 py-2 text-center">
                          <span className="text-sm text-slate-700">
                            {student.scores[field.name] !== undefined ? student.scores[field.name] : '-'}
                          </span>
                         </td>
                      ))}
                      <td className="px-3 py-2 text-center bg-emerald-50">
                        <span className="text-sm font-bold text-emerald-700">
                          {student.total !== null ? student.total : '-'}
                        </span>
                       </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-sm font-semibold text-slate-800">
                          {student.grade || '-'}
                        </span>
                       </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-sm text-slate-600">
                          {student.remark || '-'}
                        </span>
                       </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-sm font-medium text-slate-500">
                          {student.position || '-'}
                        </span>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-between items-center">
            <p className="text-xs text-slate-400">
              {data.rows.length} student{data.rows.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={sortByName}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Sort by Name
              </button>
              <button
                onClick={toggleSort}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                Sort by Score
                {sortBy === 'score' && (
                  sortOrder === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />
                )}
              </button>
              <button
                onClick={handlePrint}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Printer className="h-3 w-3" /> Print
              </button>
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> About This Result
          </h3>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li><strong>Total CA:</strong> Sum of all Continuous Assessment scores</li>
            <li><strong>Total:</strong> Sum of all CA and Exam scores</li>
            <li><strong>Grade & Remark:</strong> Automatically assigned based on total score</li>
            <li><strong>Position:</strong> Rank based on total score (students with same score share position)</li>
            <li>Statistics show highest, lowest, and average scores in the class</li>
          </ul>
        </div>
      </div>
    </>
  );
}
